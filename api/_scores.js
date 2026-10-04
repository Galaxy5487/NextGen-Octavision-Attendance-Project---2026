import supabase from './_db-client.js';
import nodemailer from 'nodemailer';

export const POINTS = { present: 1, half: 0.5, permitted: 1, absent: 0 };
export const LOW_SCORE_THRESHOLD = 75;

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

export function todayStrServer(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function gradeFor(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function monthRange(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const dim = daysInMonth(y, m);
  return { y, m, dim, start: `${monthStr}-01`, end: `${monthStr}-${pad(dim)}` };
}

// Full month computation: day list + per-employee stats.
// Scoring: Present & Permitted = 1 pt, Half = 0.5, Absent/Unmarked-past = 0.
// Sundays (unless announced working) and announced leave days are excluded.
// Future days are excluded so mid-month scores reflect elapsed days only.
export async function computeMonthStats(monthStr, employees) {
  const { y, m, dim, start, end } = monthRange(monthStr);
  const today = todayStrServer();
  const [ovRes, attRes, warnRes] = await Promise.all([
    supabase.from('calendar_overrides').select('*').gte('date', start).lte('date', end),
    supabase.from('attendance').select('*').gte('date', start).lte('date', end),
    supabase.from('warning_logs').select('id,employee_id,date').gte('date', start).lte('date', end),
  ]);
  if (ovRes.error) throw ovRes.error;
  if (attRes.error) throw attRes.error;
  const ovMap = {};
  (ovRes.data || []).forEach((o) => { ovMap[o.date] = o; });
  const rowMap = {};
  (attRes.data || []).forEach((r) => { rowMap[`${r.employee_id}|${r.date}`] = r.status; });
  const warnCount = {};
  (warnRes.data || []).forEach((w) => { warnCount[w.employee_id] = (warnCount[w.employee_id] || 0) + 1; });

  const days = [];
  let workingDays = 0;
  for (let d = 1; d <= dim; d++) {
    const date = `${monthStr}-${pad(d)}`;
    const dow = new Date(y, m - 1, d).getDay();
    const isSunday = dow === 0;
    const ov = ovMap[date] || null;
    const isLeave = ov && ov.kind === 'leave_day';
    const isWorkingSunday = isSunday && ov && ov.kind === 'sunday_working';
    const counts = !isLeave && (!isSunday || isWorkingSunday);
    const future = date > today;
    if (counts && !future) workingDays++;
    days.push({ date, dow, isSunday, override: ov ? ov.kind : null, label: ov ? ov.label : null, counts, future });
  }

  const stats = (employees || []).map((emp) => {
    let present = 0, absent = 0, half = 0, permitted = 0, unmarked = 0, earned = 0;
    days.forEach((day) => {
      if (!day.counts || day.future) return;
      const st = rowMap[`${emp.id}|${day.date}`];
      if (st === 'present') { present++; earned += 1; }
      else if (st === 'half') { half++; earned += 0.5; }
      else if (st === 'permitted') { permitted++; earned += 1; }
      else if (st === 'absent') { absent++; }
      else { unmarked++; }
    });
    const score = workingDays ? Math.round((earned / workingDays) * 1000) / 10 : null;
    return {
      employee_id: emp.id, present, absent, half, permitted, unmarked,
      earned: Math.round(earned * 10) / 10, workingDays, score,
      grade: score == null ? '' : gradeFor(score),
      low: score != null && score < LOW_SCORE_THRESHOLD,
      warnings: warnCount[emp.id] || 0,
    };
  });

  return { year: y, month: m, days, workingDays, stats };
}

export async function notifyUsers(userIds, { title, body, kind = 'info', link = null }) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  const rows = ids.map((user_id) => ({ user_id, title, body, kind, link, read: false }));
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('notify error:', error.message);
}

export async function activeUserIds(role) {
  let q = supabase.from('profiles').select('id,role').eq('active', true);
  if (role) q = q.eq('role', role);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r) => r.id);
}

// Find or create the 1-1 "Attendance Alerts" system thread between head and employee.
export async function ensureSystemThread(headId, empId, empName) {
  const { data, error } = await supabase.from('threads').select('*').eq('type', 'system').contains('member_ids', [empId]);
  if (error) throw error;
  const found = (data || []).find((t) => (t.member_ids || []).includes(headId));
  if (found) return found.id;
  const { data: created, error: cErr } = await supabase.from('threads').insert({
    type: 'system', name: `Attendance Alerts — ${empName}`, member_ids: [headId, empId], created_by: headId,
  }).select().single();
  if (cErr) throw cErr;
  return created.id;
}

export function warningEmail(empName, dateStr, score, counts) {
  const disp = score == null ? '—' : score;
  const subject = `Attendance Warning — ${empName} marked Absent on ${dateStr} (Score: ${disp}%)`;
  const body = `Dear ${empName},\n\nThis is an automated attendance warning from NextGen Octavision (Create – Innovate – Evolve).\n\nYou were marked ABSENT on ${dateStr}.\n\nYour current monthly attendance record:\n• Attendance Score: ${disp}%\n• Present: ${counts.present} day(s)\n• Absent: ${counts.absent} day(s)\n• Half days: ${counts.half}\n• Permitted leaves: ${counts.permitted}\n• Working days this month: ${counts.workingDays}\n\nPlease contact your team head if this marking is incorrect, or apply for a permission leave for future absences. Repeated absences may lead to further action and special task assignments.\n\nRegards,\nTeam Head — NextGen Octavision`;
  return { subject, body };
}

// Attempt a real email send via Brevo (supports both REST API keys xkeysib- and SMTP keys xsmtpsib-)
export async function trySendEmail(to, subject, text) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return 'logged';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'team@octavision.com';
  const smtpUser = process.env.BREVO_SMTP_USER || senderEmail;
  const logoUrl = 'https://nextgen-octavision.netlify.app/logo.png';
  const safe = String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05)">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#09090b;padding:20px 24px">` +
    `<tr>` +
    `<td width="56" style="vertical-align:middle"><img src="${logoUrl}" width="48" height="48" alt="NextGen Octavision" style="width:48px;height:48px;border-radius:12px;object-fit:cover;background:#ffffff;border:1px solid rgba(255,255,255,0.2);display:block" /></td>` +
    `<td style="vertical-align:middle;padding-left:14px"><h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;line-height:1.2">NextGen Octavision</h2><p style="margin:4px 0 0;color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:2px">CREATE – INNOVATE – EVOLVE</p></td>` +
    `</tr></table>` +
    `<div style="padding:24px;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#18181b">${safe}</div>` +
    `<div style="background:#f4f4f5;padding:14px 24px;border-t:1px solid #e4e4e7;font-size:11px;color:#71717a;text-align:center">NextGen Octavision Attendance & Agency Portal</div></div>`;

  // 1. If key is an SMTP key (starts with xsmtpsib-), use Nodemailer SMTP relay
  if (key.startsWith('xsmtpsib-')) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
        port: Number(process.env.BREVO_SMTP_PORT || 587),
        secure: process.env.BREVO_SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: key },
      });
      await transporter.sendMail({
        from: `"NextGen Octavision" <${senderEmail}>`,
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        text: String(text || ''),
        html,
      });
      return 'sent';
    } catch (e) {
      console.error('brevo smtp send failed:', e.message);
      return 'logged';
    }
  }

  // 2. Otherwise (starts with xkeysib-), use Brevo v3 REST API
  try {
    const recipients = (Array.isArray(to) ? to : [to]).map((e) => ({ email: e }));
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'NextGen Octavision', email: senderEmail },
        to: recipients,
        subject,
        htmlContent: html,
        textContent: String(text || ''),
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('brevo rest api send failed:', r.status, String(t).slice(0, 500));
      return 'logged';
    }
    return 'sent';
  } catch (e) {
    console.error('email send failed:', e.message);
    return 'logged';
  }
}

