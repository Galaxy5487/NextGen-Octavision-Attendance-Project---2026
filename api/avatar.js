import supabase from './_db-client.js';
import { netlifyAdapter } from './_adapter.js';

const BUCKET = 'avatars';
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { user_id } = req.query;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });
      const { data } = await supabase.from('profile_photos').select('url').eq('user_id', user_id).limit(1);
      return res.status(200).json({ url: (data && data[0] && data[0].url) || null });
    }
    if (req.method === 'POST') {
      const { user_id, fileName, fileBase64, contentType } = req.body || {};
      if (!user_id || !fileName || !fileBase64) return res.status(400).json({ error: 'user_id, fileName and fileBase64 required' });
      if (contentType && !ALLOWED.includes(contentType)) return res.status(400).json({ error: 'Only PNG, JPG or WEBP images allowed' });
      if (fileBase64.length > 2800000) return res.status(400).json({ error: 'Image too large (max 2MB)' });
      const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `user-${user_id}-${Date.now()}-${safe}`;
      const buffer = Buffer.from(fileBase64, 'base64');
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: contentType || 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = urlData.publicUrl;
      // Remove previous photo (best-effort) and replace row
      const { data: prev } = await supabase.from('profile_photos').select('*').eq('user_id', user_id).limit(1);
      if (prev && prev[0]) {
        if (prev[0].path) { try { await supabase.storage.from(BUCKET).remove([prev[0].path]); } catch {} }
        await supabase.from('profile_photos').delete().eq('user_id', user_id);
      }
      const { error: insErr } = await supabase.from('profile_photos').insert({ user_id, url, path });
      if (insErr) throw insErr;
      return res.status(201).json({ url });
    }
    if (req.method === 'DELETE') {
      const { user_id } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'user_id required' });
      const { data: prev } = await supabase.from('profile_photos').select('*').eq('user_id', user_id).limit(1);
      if (prev && prev[0] && prev[0].path) { try { await supabase.storage.from(BUCKET).remove([prev[0].path]); } catch {} }
      await supabase.from('profile_photos').delete().eq('user_id', user_id);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('avatar error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


