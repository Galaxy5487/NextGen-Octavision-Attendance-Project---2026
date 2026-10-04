import supabase from './_db-client.js';
import { computeMonthStats, ensureSystemThread, notifyUsers, warningEmail, trySendEmail } from './_scores.js';
import { netlifyAdapter } from './_adapter.js';

async function upsertRow(employee_id, date, status, note, marked_by) {
  const { data: existing } = await supabase.from('attendance').select('id,status').eq('employee_id', employee_id).eq('date', date).limit(1);
  const prev = existing && existing.length ? existing[0] : null;
  if (prev) {
    const { data, error } = await supabase.from('attendance').update({ status, note: note || null, marked_by: marked_by || null, updated_at: new Date().toISOString() }).eq('id', prev.id).select().single();
    if (error) throw error;
    return { row: data, prevStatus: prev.status };
  }
  const { data, error } = await supabase.from('attendance').insert({ employee_id, date, status, note: note || null, marked_by: marked_by || null }).select().single();
  if (error) throw error;
  return { row: data, prevStatus: null };
}

async function issueAbsenceWarning(emp, date, marked_by) {
  const monthStr = date.slice(0, 7);
  const computed = await computeMonthStats(monthStr, [emp]);
  const s = computed.stats[0];
  if (s.score == null) return null; // future date — nothing elapsed, no warning
  const { subject, body } = warningEmail(emp.full_name, date, s.score, s);

  const recipientEmails = new Set();
  if (emp.email) recipientEmails.add(emp.email);
  try {
    const { data: head } = await supabase.from('profiles').select('email').eq('role', 'head');
    (head || []).forEach((h) => { if (h.email) recipientEmails.add(h.email); });
  } catch {}

  const email_status = await trySendEmail([...recipientEmails], subject, body);
  const { data: log, error } = await supabase.from('warning_logs').insert({
    employee_id: emp.id, date, subject, body, score_snapshot: s.score, email_status,
  }).select().single();
  if (error) throw error;
  // Chat notification into the employee's Attendance Alerts thread
  try {
    const headId = marked_by || emp.id;
    const { data: head } = await supabase.from('profiles').select('*').eq('role', 'head').limit(1);
    const headUser = (head || [])[0];
    const senderId = headUser ? headUser.id : headId;
    const threadId = await ensureSystemThread(senderId, emp.id, emp.full_name);
    await supabase.from('messages').insert({
      thread_id: threadId, sender_id: senderId, kind: 'warning',
      body: `⚠️ Attendance Warning: ${emp.full_name}, you were marked ABSENT on ${date}. Month score: ${s.score}% (P:${s.present} A:${s.absent} H:${s.half} PL:${s.permitted}). A warning email was sent to ${emp.email}.`,
    });
  } catch (e) { console.error('warning chat failed:', e.message); }
  await notifyUsers([emp.id], { title: 'Attendance Warning — Absent', body: `${emp.full_name}, you were marked absent on ${date}. Month score: ${s.score}%. Warning email sent.`, kind: 'warning', link: '#/app/warnings' });
  return log;
}

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { month, employee_id, date, from, to } = req.query;
      let q = supabase.from('attendance').select('*').order('date', { ascending: true });
      if (month) { q = q.gte('date', `${month}-01`).lte('date', `${month}-31`); }
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to);
      if (date) q = q.eq('date', date);
      if (employee_id) q = q.eq('employee_id', employee_id);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      // Bulk daily log: { date, entries: [{employee_id,status,note}], marked_by }
      const { date, entries, marked_by } = req.body || {};
      if (!date || !Array.isArray(entries)) return res.status(400).json({ error: 'date and entries[] required' });
      const { data: emps } = await supabase.from('profiles').select('*').eq('role', 'employee');
      const empMap = {};
      (emps || []).forEach((e) => { empMap[e.id] = e; });
      const warnings = [];
      for (const en of entries) {
        if (!en.employee_id || !en.status) continue;
        const { prevStatus } = await upsertRow(en.employee_id, date, en.status, en.note, marked_by);
        if (en.status === 'absent' && prevStatus !== 'absent' && empMap[en.employee_id]) {
          const log = await issueAbsenceWarning(empMap[en.employee_id], date, marked_by);
          if (log) warnings.push(log);
        }
      }
      return res.status(200).json({ ok: true, saved: entries.length, warnings });
    }
    if (req.method === 'PUT') {
      const { id, employee_id, date, status, note, marked_by, warn } = req.body || {};
      let row, prevStatus = null, empId = employee_id, rowDate = date;
      if (id) {
        const { data: cur } = await supabase.from('attendance').select('*').eq('id', id).single();
        if (!cur) return res.status(404).json({ error: 'Record not found' });
        prevStatus = cur.status; empId = cur.employee_id; rowDate = cur.date;
        const { data, error } = await supabase.from('attendance').update({ status: status || cur.status, note: note !== undefined ? note : cur.note, marked_by: marked_by || cur.marked_by, updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (error) throw error;
        row = data;
      } else {
        if (!employee_id || !date || !status) return res.status(400).json({ error: 'employee_id, date and status required' });
        const r = await upsertRow(employee_id, date, status, note, marked_by);
        row = r.row; prevStatus = r.prevStatus;
      }
      let warning = null;
      if (warn !== false && row.status === 'absent' && prevStatus !== 'absent') {
        const { data: emp } = await supabase.from('profiles').select('*').eq('id', empId).single();
        if (emp) warning = await issueAbsenceWarning(emp, rowDate, marked_by);
      }
      return res.status(200).json({ row, warning });
    }
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await supabase.from('attendance').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('attendance error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


