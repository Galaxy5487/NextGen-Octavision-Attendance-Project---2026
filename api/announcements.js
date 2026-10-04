import supabase from './_db-client.js';
import { notifyUsers, activeUserIds, trySendEmail } from './_scores.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { title, body, kind, created_by, audience } = req.body || {};
      if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
      const { data, error } = await supabase.from('announcements').insert({
        title, body, kind: kind || 'general', created_by: created_by || null, audience: audience || 'all',
      }).select().single();
      if (error) throw error;
      const ids = await activeUserIds();
      await notifyUsers(ids.filter((i) => i !== created_by), { title: `Announcement: ${title}`, body: body.slice(0, 140), kind: 'announcement', link: '#/app/announcements' });

      // Dispatch email notification to all active team profiles
      try {
        const { data: profiles } = await supabase.from('profiles').select('email').eq('active', true);
        const emails = [...new Set((profiles || []).map((p) => p.email).filter(Boolean))];
        if (emails.length) {
          const emailSubject = `📢 Announcement: ${title}`;
          const emailBody = `Dear Team Member,\n\nA new announcement has been published on NextGen Octavision:\n\n📌 ${title}\n--------------------------------------------------\n${body}\n\nLog in to view the announcement:\nhttps://nextgen-octavision.netlify.app\n\nRegards,\nNextGen Octavision Team`;
          await trySendEmail(emails, emailSubject, emailBody);
        }
      } catch (eErr) {
        console.error('announcement email dispatch error:', eErr);
      }

      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      const { id, clear_all } = req.body || {};
      if (clear_all) {
        const { error } = await supabase.from('announcements').delete().gte('id', 0);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('announcements error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


