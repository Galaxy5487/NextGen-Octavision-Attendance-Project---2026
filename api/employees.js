import supabase from './_db-client.js';
import { netlifyAdapter } from './_adapter.js';

const strip = (u, photoMap) => { const { password: _p, ...safe } = u; safe.avatar_url = (photoMap && photoMap[u.id]) || null; return safe; };

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('profiles').select('*').order('id', { ascending: true });
      if (error) throw error;
      const photoMap = {};
      try {
        const { data: photos } = await supabase.from('profile_photos').select('user_id,url');
        (photos || []).forEach((p) => { photoMap[p.user_id] = p.url; });
      } catch {}
      return res.status(200).json((data || []).map((u) => strip(u, photoMap)));
    }
    if (req.method === 'POST') {
      const { full_name, email, password, designation, phone, role } = req.body || {};
      if (!full_name || !password) return res.status(400).json({ error: 'Full name and password are required' });
      const em = String(email || 'octavisionteam@gmail.com').trim().toLowerCase();
      const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if ((role || 'employee') === 'employee') {
        const { data: sameName } = await supabase.from('profiles').select('id,full_name').eq('role', 'employee');
        if ((sameName || []).some((r) => norm(r.full_name) === norm(full_name))) {
          return res.status(400).json({ error: 'An employee with this full name already exists' });
        }
      } else {
        const { data: existing } = await supabase.from('profiles').select('id').ilike('email', em);
        if (existing && existing.length) return res.status(400).json({ error: 'Email already exists' });
      }
      const colors = ['#18181b', '#3f3f46', '#713f12', '#14532d', '#1e3a8a', '#581c87', '#7c2d12', '#0f766e'];
      const { data, error } = await supabase.from('profiles').insert({
        full_name: full_name.trim(), email: em, password,
        designation: designation || 'Team Member', phone: phone || '',
        role: role || 'employee', avatar_color: colors[Math.floor(Math.random() * colors.length)], active: true,
      }).select().single();
      if (error) throw error;
      return res.status(201).json(strip(data));
    }
    if (req.method === 'PUT') {
      const { id, full_name, designation, phone, password, active } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (full_name !== undefined) {
        const { data: target } = await supabase.from('profiles').select('id,role').eq('id', id).single();
        if (target && target.role === 'employee') {
          const { data: others } = await supabase.from('profiles').select('id,full_name').eq('role', 'employee').neq('id', id);
          if ((others || []).some((r) => norm(r.full_name) === norm(full_name))) {
            return res.status(400).json({ error: 'Another employee already has this full name' });
          }
        }
      }
      const patch = {};
      if (full_name !== undefined) patch.full_name = full_name;
      if (designation !== undefined) patch.designation = designation;
      if (phone !== undefined) patch.phone = phone;
      if (password) patch.password = password;
      if (active !== undefined) patch.active = active;
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(strip(data));
    }
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) {
        await supabase.from('profiles').update({ active: false }).eq('id', id);
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('employees error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


