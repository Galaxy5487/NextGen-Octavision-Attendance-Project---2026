import supabase from './_db-client.js';
import { computeMonthStats, ensureSystemThread, notifyUsers, warningEmail, trySendEmail } from './_scores.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { employee_id, month } = req.query;
      let q = supabase.from('warning_logs').select('*').order('created_at', { ascending: false }).limit(300);
      if (employee_id) q = q.eq('employee_id', employee_id);
      if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      // Manual warning from team head
      const { employee_id, date, custom_note, sent_by } = req.body || {};
      if (!employee_id || !date) return res.status(400).json({ error: 'employee_id and date required' });
      const { data: emp, error: eErr } = await supabase.from('profiles').select('*').eq('id', employee_id).single();
      if (eErr) throw eErr;
      const computed = await computeMonthStats(date.slice(0, 7), [emp]);
      const s = computed.stats[0];
      const { subject, body } = warningEmail(emp.full_name, date, s.score, s);
      const fullBody = custom_note ? `${body}\n\nNote from Team Head: ${custom_note}` : body;
      const recipientEmails = new Set();
      if (emp.email) recipientEmails.add(emp.email);
      try {
        const { data: head } = await supabase.from('profiles').select('email').eq('role', 'head');
        (head || []).forEach((h) => { if (h.email) recipientEmails.add(h.email); });
      } catch {}

      const email_status = await trySendEmail([...recipientEmails], subject, fullBody);
      const { data, error } = await supabase.from('warning_logs').insert({
        employee_id, date, subject, body: fullBody, score_snapshot: s.score, email_status,
      }).select().single();
      if (error) throw error;
      const { data: head } = await supabase.from('profiles').select('*').eq('role', 'head').limit(1);
      const senderId = (head || [])[0] ? head[0].id : sent_by;
      const threadId = await ensureSystemThread(senderId, emp.id, emp.full_name);
      await supabase.from('messages').insert({ thread_id: threadId, sender_id: senderId, kind: 'warning', body: `⚠️ Manual Warning for ${emp.full_name} (${date}). Month score: ${s.score}%. ${custom_note || ''}` });
      await notifyUsers([emp.id], { title: 'Attendance Warning', body: `${emp.full_name}, a warning was issued for ${date}. Score: ${s.score}%.`, kind: 'warning', link: '#/app/warnings' });
      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      const { id, employee_id, clear_all } = req.body || {};
      if (id) {
        const { error } = await supabase.from('warning_logs').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (employee_id && clear_all) {
        const { error } = await supabase.from('warning_logs').delete().eq('employee_id', employee_id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'id required' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('warnings error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


