import supabase from './_db-client.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { user_id, limit } = req.query;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });
      const { data, error } = await supabase.from('notifications').select('*').eq('user_id', user_id).order('created_at', { ascending: false }).limit(Math.min(parseInt(limit || '60', 10), 150));
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { user_id, title, body, kind, link } = req.body || {};
      if (!user_id || !title) return res.status(400).json({ error: 'user_id and title required' });
      const { data, error } = await supabase.from('notifications').insert({ user_id, title, body: body || '', kind: kind || 'info', link: link || null }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, user_id_all } = req.body || {};
      if (id) {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
        if (error) throw error;
      } else if (user_id_all) {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user_id_all).eq('read', false);
        if (error) throw error;
      } else return res.status(400).json({ error: 'id or user_id_all required' });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { id, user_id } = req.body || {};
      if (id) {
        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (error) throw error;
      } else if (user_id) {
        const { error } = await supabase.from('notifications').delete().eq('user_id', user_id);
        if (error) throw error;
      } else return res.status(400).json({ error: 'id or user_id required' });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('notifications error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


