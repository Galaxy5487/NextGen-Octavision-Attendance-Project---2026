import supabase from './_db-client.js';
import { notifyUsers, activeUserIds } from './_scores.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { month, from, to } = req.query;
      let q = supabase.from('calendar_overrides').select('*').order('date', { ascending: true });
      if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`);
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { date, kind, label, created_by, announce } = req.body || {};
      if (!date || !['sunday_working', 'leave_day'].includes(kind)) return res.status(400).json({ error: 'date and valid kind required' });
      const { data: existing } = await supabase.from('calendar_overrides').select('*').eq('date', date).limit(1);
      let override;
      if (existing && existing.length) {
        const { data, error } = await supabase.from('calendar_overrides').update({ kind, label: label || null, created_by: created_by || null }).eq('id', existing[0].id).select().single();
        if (error) throw error;
        override = data;
      } else {
        const { data, error } = await supabase.from('calendar_overrides').insert({ date, kind, label: label || null, created_by: created_by || null, announced: false }).select().single();
        if (error) throw error;
        override = data;
      }
      // Update attendance accordingly
      if (kind === 'leave_day') {
        const { data: emps } = await supabase.from('profiles').select('id').eq('role', 'employee').eq('active', true);
        for (const e of (emps || [])) {
          const { data: cur } = await supabase.from('attendance').select('id').eq('employee_id', e.id).eq('date', date).limit(1);
          const note = `Office leave — ${label || date}`;
          if (cur && cur.length) await supabase.from('attendance').update({ status: 'leave', note }).eq('id', cur[0].id);
          else await supabase.from('attendance').insert({ employee_id: e.id, date, status: 'leave', note, marked_by: created_by || null });
        }
      } else if (kind === 'sunday_working') {
        // Clear auto leave/sunday marks so the day counts as a working day
        await supabase.from('attendance').delete().eq('date', date).in('status', ['leave', 'sunday']);
      }
      // Announce it
      if (announce !== false) {
        const isLeave = kind === 'leave_day';
        const title = isLeave ? `Office Leave — ${date}` : `Working Sunday — ${date}`;
        const body = isLeave
          ? `${label || 'Office will remain closed'} on ${date}. Attendance for this day is marked as Leave for everyone.`
          : `${label || 'Sunday is a working day'} on ${date}. Attendance will be marked as normal. Please be present.`;
        await supabase.from('announcements').insert({ title, body, kind, created_by: created_by || null, audience: 'all' });
        await supabase.from('calendar_overrides').update({ announced: true }).eq('id', override.id);
        override.announced = true;
        const ids = await activeUserIds();
        await notifyUsers(ids.filter((i) => i !== created_by), { title, body, kind: 'announcement', link: '#/app/announcements' });
      }
      return res.status(200).json(override);
    }
    if (req.method === 'DELETE') {
      const { id, date } = req.body || {};
      let ov = null;
      if (id) {
        const { data } = await supabase.from('calendar_overrides').select('*').eq('id', id).single();
        ov = data;
      } else if (date) {
        const { data } = await supabase.from('calendar_overrides').select('*').eq('date', date).limit(1);
        ov = (data || [])[0] || null;
      }
      if (!ov) return res.status(404).json({ error: 'Override not found' });
      await supabase.from('calendar_overrides').delete().eq('id', ov.id);
      if (ov.kind === 'leave_day') {
        await supabase.from('attendance').delete().eq('date', ov.date).eq('status', 'leave');
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('calendar error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


