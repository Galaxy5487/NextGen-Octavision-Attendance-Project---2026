import supabase from './_db-client.js';
import { notifyUsers, activeUserIds } from './_scores.js';
import { netlifyAdapter } from './_adapter.js';

function eachDate(from, to) {
  const out = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur <= end) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { employee_id, status } = req.query;
      let q = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
      if (employee_id) q = q.eq('employee_id', employee_id);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { employee_id, from_date, to_date, reason } = req.body || {};
      if (!employee_id || !from_date || !to_date || !reason) return res.status(400).json({ error: 'All fields are required' });
      if (from_date > to_date) return res.status(400).json({ error: 'From date must be before To date' });
      const { data, error } = await supabase.from('leave_requests').insert({
        employee_id, from_date, to_date, reason, status: 'pending',
      }).select().single();
      if (error) throw error;
      const heads = await activeUserIds('head');
      await notifyUsers(heads, { title: 'New Leave Request', body: `${from_date} → ${to_date}: ${reason.slice(0, 120)}`, kind: 'leave', link: '#/app/leaves' });
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, status, decided_by } = req.body || {};
      if (!id || !['permitted', 'denied'].includes(status)) return res.status(400).json({ error: 'id and valid status required' });
      const { data: cur, error: cErr } = await supabase.from('leave_requests').select('*').eq('id', id).single();
      if (cErr) throw cErr;
      const { data, error } = await supabase.from('leave_requests').update({ status, decided_by: decided_by || null, decided_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      if (status === 'permitted') {
        // Mark attendance as permitted for working days in range
        const dates = eachDate(cur.from_date, cur.to_date);
        const { data: ovs } = await supabase.from('calendar_overrides').select('*').gte('date', cur.from_date).lte('date', cur.to_date);
        const ovMap = {};
        (ovs || []).forEach((o) => { ovMap[o.date] = o.kind; });
        for (const ds of dates) {
          const [yy, mm, dd] = ds.split('-').map(Number);
          const dow = new Date(yy, mm - 1, dd).getDay();
          const ov = ovMap[ds];
          if (ov === 'leave_day') continue;
          if (dow === 0 && ov !== 'sunday_working') continue;
          const { data: ex } = await supabase.from('attendance').select('id').eq('employee_id', cur.employee_id).eq('date', ds).limit(1);
          const note = 'Permission leave approved';
          if (ex && ex.length) await supabase.from('attendance').update({ status: 'permitted', note }).eq('id', ex[0].id);
          else await supabase.from('attendance').insert({ employee_id: cur.employee_id, date: ds, status: 'permitted', note, marked_by: decided_by || null });
        }
      }
      await notifyUsers([cur.employee_id], {
        title: status === 'permitted' ? 'Leave Permitted ✅' : 'Leave Denied',
        body: `Your leave ${cur.from_date} → ${cur.to_date} was ${status}.`, kind: 'leave', link: '#/app/leaves',
      });
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id, employee_id, clear_processed } = req.body || {};
      if (id) {
        const { error } = await supabase.from('leave_requests').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (clear_processed) {
        let q = supabase.from('leave_requests').delete().in('status', ['permitted', 'denied']);
        if (employee_id) q = q.eq('employee_id', employee_id);
        const { error } = await q;
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'id required' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('leaves error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


