import supabase from './_db-client.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { user_id } = req.query;
      const { data, error } = await supabase.from('threads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      let threads = data || [];
      if (user_id) {
        const uid = Number(user_id);
        threads = threads.filter((t) => (t.member_ids || []).map(Number).includes(uid));
      }
      // Attach last message preview
      if (threads.length) {
        const ids = threads.map((t) => t.id);
        const { data: msgs } = await supabase.from('messages').select('thread_id,body,created_at').in('thread_id', ids).order('created_at', { ascending: false }).limit(200);
        const last = {};
        (msgs || []).forEach((m) => { if (!last[m.thread_id]) last[m.thread_id] = m; });
        threads.forEach((t) => { t.last_message = last[t.id] || null; });
      }
      return res.status(200).json(threads);
    }
    if (req.method === 'POST') {
      const { type, name, member_ids, created_by } = req.body || {};
      if (!name || !Array.isArray(member_ids) || member_ids.length < 2) return res.status(400).json({ error: 'Name and at least 2 members required' });
      // Avoid duplicate DMs
      if (type === 'dm') {
        const { data: all } = await supabase.from('threads').select('*').eq('type', 'dm');
        const setKey = (arr) => (arr || []).map(Number).sort((a, b) => a - b).join(',');
        const targetKey = setKey(member_ids);
        const dup = (all || []).find((t) => setKey(t.member_ids) === targetKey);
        if (dup) return res.status(200).json(dup);
      }
      const { data, error } = await supabase.from('threads').insert({
        type: type || 'group', name, member_ids, created_by: created_by || null,
      }).select().single();
      if (error) throw error;
      if ((type || 'group') === 'group') {
        await supabase.from('messages').insert({ thread_id: data.id, sender_id: created_by || null, kind: 'chat', body: `Group "${name}" created. Welcome! 🎉` });
      }
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, name, member_ids } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const patch = {};
      if (name !== undefined) patch.name = name;
      if (member_ids !== undefined) patch.member_ids = member_ids;
      const { data, error } = await supabase.from('threads').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      await supabase.from('messages').delete().eq('thread_id', id);
      const { error } = await supabase.from('threads').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('threads error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


