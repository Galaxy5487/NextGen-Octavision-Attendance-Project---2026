import supabase from './_db-client.js';
import { computeMonthStats, LOW_SCORE_THRESHOLD } from './_scores.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const now = new Date();
      const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { data: emps, error } = await supabase.from('profiles').select('*').eq('role', 'employee').eq('active', true).order('id');
      if (error) throw error;
      const computed = await computeMonthStats(month, emps || []);
      const photoMap = {};
      try {
        const { data: photos } = await supabase.from('profile_photos').select('user_id,url');
        (photos || []).forEach((p) => { photoMap[p.user_id] = p.url; });
      } catch {}
      const employees = (emps || []).map((e) => {
        const { password: _p, ...safe } = e;
        safe.avatar_url = photoMap[e.id] || null;
        return safe;
      });
      return res.status(200).json({ ...computed, employees, low_threshold: LOW_SCORE_THRESHOLD });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('stats error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);


