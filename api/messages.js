import supabase from './_db-client.js';
import { notifyUsers } from './_scores.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { thread_id, limit } = req.query;
      if (!thread_id) return res.status(400).json({ error: 'thread_id required' });
      const { data, error } = await supabase.from('messages').select('*').eq('thread_id', thread_id).order('created_at', { ascending: true }).limit(Math.min(parseInt(limit || '300', 10), 500));
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { thread_id, sender_id, body, kind } = req.body || {};
      if (!thread_id || !body) return res.status(400).json({ error: 'thread_id and body required' });
      const { data, error } = await supabase.from('messages').insert({
        thread_id, sender_id: sender_id || null, body, kind: kind || 'chat',
      }).select().single();
      if (error) throw error;
      const { data: thread } = await supabase.from('threads').select('*').eq('id', thread_id).single();
      if (thread) {
        const others = (thread.member_ids || []).filter((i) => i !== sender_id);
        await notifyUsers(others, { title: thread.name, body: String(body).slice(0, 140), kind: 'chat', link: '#/app/chat' });
      }
      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      const { id, thread_id } = req.body || {};
      if (id) {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (thread_id) {
        const { error } = await supabase.from('messages').delete().eq('thread_id', thread_id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'id or thread_id required' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('messages error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


