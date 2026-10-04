import supabase from './_db-client.js';
import { notifyUsers } from './_scores.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { assignee_id, status } = req.query;
      let q = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (assignee_id) q = q.eq('assignee_id', assignee_id);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { title, description, assignee_id, assigned_by, due_date, priority } = req.body || {};
      if (!title || !assignee_id) return res.status(400).json({ error: 'Title and assignee required' });
      const { data, error } = await supabase.from('tasks').insert({
        title, description: description || '', assignee_id, assigned_by: assigned_by || null,
        due_date: due_date || null, priority: priority || 'medium', status: 'pending',
      }).select().single();
      if (error) throw error;
      await notifyUsers([assignee_id], { title: 'New Task Assigned', body: `${title}${due_date ? ` — due ${due_date}` : ''}`, kind: 'task', link: '#/app/tasks' });
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, title, description, due_date, priority, status } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const patch = {};
      if (title !== undefined) patch.title = title;
      if (description !== undefined) patch.description = description;
      if (due_date !== undefined) patch.due_date = due_date;
      if (priority !== undefined) patch.priority = priority;
      if (status !== undefined) patch.status = status;
      const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id, clear_done, assignee_id } = req.body || {};
      if (clear_done) {
        let q = supabase.from('tasks').delete().eq('status', 'done');
        if (assignee_id) q = q.eq('assignee_id', assignee_id);
        const { error } = await q;
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('tasks error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


