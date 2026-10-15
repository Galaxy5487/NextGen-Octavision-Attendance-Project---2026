import crypto from 'crypto';
import supabase, { invalidateCache } from './_db-client.js';
import { netlifyAdapter } from './_adapter.js';

const QR_SECRET = process.env.QR_SECRET || 'octavision-qr-attendance-key-2026';
const WINDOW_DURATION_SEC = 30; // Rotate token every 30 seconds for anti-proxy security

function pad(n) {
  return String(n).padStart(2, '0');
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getWindow(timestamp = Date.now()) {
  return Math.floor(timestamp / (WINDOW_DURATION_SEC * 1000));
}

// In-memory store for active session custom salts and recent check-ins
const sessionStore = {
  salts: new Map(), // date -> salt
  recentScans: [],  // list of latest scans today
};

function getDailySalt(date) {
  const custom = sessionStore.salts.get(date);
  if (custom) return custom;
  return crypto.createHmac('sha256', QR_SECRET).update(`salt:${date}`).digest('hex').slice(0, 16);
}

function getWindowSignature(date, windowIndex, salt) {
  return crypto
    .createHmac('sha256', QR_SECRET)
    .update(`${date}:${windowIndex}:${salt}`)
    .digest('hex');
}

function getWindowCode(date, windowIndex, salt) {
  const hash = crypto
    .createHash('sha256')
    .update(`${QR_SECRET}:${date}:${windowIndex}:${salt}`)
    .digest('hex');
  const num = parseInt(hash.slice(0, 6), 16) % 90000 + 10000;
  return `OCT-${num}`;
}

function generateSessionToken(date, leaderId) {
  const salt = getDailySalt(date);
  const now = Date.now();
  const currentWindow = getWindow(now);
  const signature = getWindowSignature(date, currentWindow, salt);
  const code = getWindowCode(date, currentWindow, salt);

  const payload = {
    v: 1,
    app: 'nextgen-octavision',
    date,
    leader_id: leaderId || 1,
    w: currentWindow,
    s: salt,
    sig: signature,
    exp: (currentWindow + 1) * WINDOW_DURATION_SEC * 1000,
  };

  const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const elapsedInWindow = Math.floor((now % (WINDOW_DURATION_SEC * 1000)) / 1000);
  const remainingSec = Math.max(1, WINDOW_DURATION_SEC - elapsedInWindow);

  return {
    token,
    code,
    window: currentWindow,
    remainingSec,
    intervalSec: WINDOW_DURATION_SEC,
    date,
    leader_id: leaderId || 1,
  };
}

function verifyTokenOrCode(token, code, today) {
  const now = Date.now();
  const currentWindow = getWindow(now);
  const salt = getDailySalt(today);

  // 1. Verify 6-digit short code (allow ±2 windows for clock skew and up to 10 past windows for scan delay)
  if (code && typeof code === 'string') {
    const cleanCode = code.trim().toUpperCase();
    for (let w = currentWindow + 2; w >= currentWindow - 10; w--) {
      const expectedCode = getWindowCode(today, w, salt);
      if (cleanCode === expectedCode) {
        return { valid: true, method: 'code', window: w };
      }
    }
  }

  // 2. Verify dynamic QR base64url token
  if (token && typeof token === 'string') {
    try {
      const decodedStr = Buffer.from(token, 'base64url').toString('utf-8');
      const payload = JSON.parse(decodedStr);

      if (!payload || payload.app !== 'nextgen-octavision') {
        return { valid: false, error: 'Invalid QR token source' };
      }
      if (payload.date !== today) {
        return { valid: false, error: `QR code expired. Generated for ${payload.date}, but today is ${today}.` };
      }

      // Allow current window, forward clock skew up to 2 windows, and up to 10 past windows (~5 mins)
      const windowDiff = currentWindow - payload.w;
      if (windowDiff < -2 || windowDiff > 10) {
        return { valid: false, error: 'QR Code has expired. Please scan the current live QR code on screen.' };
      }

      const expectedSig = getWindowSignature(payload.date, payload.w, payload.s || salt);
      if (payload.sig !== expectedSig) {
        return { valid: false, error: 'QR signature verification failed.' };
      }

      return { valid: true, method: 'token', window: payload.w };
    } catch {
      return { valid: false, error: 'Malformed QR code token.' };
    }
  }

  return { valid: false, error: 'No valid token or code provided.' };
}

async function getEmployeesList() {
  try {
    const { data } = await supabase.from('profiles').select('id,full_name,designation,avatar_color,avatar_url,role,active').eq('role', 'employee');
    const active = (data || []).filter((e) => e.active !== false);
    if (active.length > 0) return active;
  } catch {}
  return [
    { id: 2, full_name: 'Ayesha Khan', role: 'employee', designation: 'UI/UX Designer', avatar_color: '#3f3f46', active: true },
    { id: 3, full_name: 'Mohammed Irbaz S', role: 'employee', designation: 'Software Engineer', avatar_color: '#1e3a8a', active: true },
  ];
}

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const today = getTodayStr();

    if (req.method === 'GET') {
      const { action = 'session', leader_id, employee_id, date = today } = req.query;

      // 1. Fetch current live scan feed
      if (action === 'live_feed' || action === 'scans') {
        const [employees, attRes] = await Promise.all([
          getEmployeesList(),
          supabase.from('attendance').select('*').eq('date', date),
        ]);

        const empMap = new Map();
        employees.forEach((e) => empMap.set(e.id, e));

        const markedRows = (attRes.data || []).filter((r) => r.status === 'present' || r.status === 'half');
        const scans = markedRows.map((r) => {
          const emp = empMap.get(r.employee_id);
          return {
            id: r.id,
            employee_id: r.employee_id,
            full_name: emp ? emp.full_name : `Employee #${r.employee_id}`,
            designation: emp ? emp.designation : '',
            avatar_color: emp ? emp.avatar_color : '#3f3f46',
            avatar_url: emp?.avatar_url || null,
            status: r.status,
            note: r.note,
            marked_at: r.updated_at || r.created_at,
          };
        }).sort((a, b) => new Date(b.marked_at).getTime() - new Date(a.marked_at).getTime());

        return res.status(200).json({
          ok: true,
          date,
          total_employees: employees.length,
          total_marked: scans.length,
          scans,
        });
      }

      // 2. Check individual employee attendance status for today
      if (action === 'employee_status') {
        if (!employee_id) return res.status(400).json({ error: 'employee_id required' });
        const { data: rows } = await supabase.from('attendance').select('*').eq('employee_id', employee_id).eq('date', date).limit(1);
        const row = rows && rows.length ? rows[0] : null;
        return res.status(200).json({
          ok: true,
          marked: Boolean(row && (row.status === 'present' || row.status === 'half')),
          status: row ? row.status : null,
          row,
        });
      }

      // 3. Default: Generate / return rolling session for Team Leader
      const session = generateSessionToken(today, leader_id ? Number(leader_id) : 1);

      // Also get today's quick summary
      const [employees, attRes] = await Promise.all([
        getEmployeesList(),
        supabase.from('attendance').select('id,employee_id,status,note,created_at,updated_at').eq('date', today),
      ]);

      const empMap = new Map();
      employees.forEach((e) => empMap.set(e.id, e));

      const scans = (attRes.data || [])
        .filter((r) => r.status === 'present' || r.status === 'half')
        .map((r) => {
          const emp = empMap.get(r.employee_id);
          return {
            id: r.id,
            employee_id: r.employee_id,
            full_name: emp ? emp.full_name : `Employee #${r.employee_id}`,
            designation: emp ? emp.designation : '',
            avatar_color: emp ? emp.avatar_color : '#3f3f46',
            avatar_url: emp?.avatar_url || null,
            status: r.status,
            note: r.note,
            marked_at: r.updated_at || r.created_at,
          };
        })
        .sort((a, b) => new Date(b.marked_at).getTime() - new Date(a.marked_at).getTime());

      return res.status(200).json({
        ok: true,
        ...session,
        total_employees: employees.length,
        total_marked: scans.length,
        recent_scans: scans.slice(0, 10),
      });
    }

    if (req.method === 'POST') {
      const { action = 'mark', token, code, employee_id, leader_id, status = 'present' } = req.body || {};

      // Action: Force refresh / new session salt
      if (action === 'refresh') {
        sessionStore.salts.set(today, crypto.randomBytes(8).toString('hex'));
        const newSession = generateSessionToken(today, leader_id ? Number(leader_id) : 1);
        return res.status(200).json({ ok: true, ...newSession });
      }

      // Action: Member scans QR and marks attendance
      if (action === 'mark') {
        if (!employee_id) {
          return res.status(400).json({ error: 'employee_id is required' });
        }

        // 1. Verify token or code
        const verification = verifyTokenOrCode(token, code, today);
        if (!verification.valid) {
          return res.status(400).json({ error: verification.error || 'Invalid or expired QR code.' });
        }

        // 2. Verify employee exists and is active
        let empData = null;
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', employee_id).single();
          if (data && !Array.isArray(data)) {
            empData = data;
          } else if (Array.isArray(data) && data.length) {
            empData = data.find((p) => p.id === Number(employee_id)) || data[0];
          }
        } catch {}

        if (!empData || empData.id !== Number(employee_id)) {
          const fallbackProfiles = [
            { id: 1, full_name: 'Team Head', role: 'head', designation: 'Team Head', avatar_color: '#18181b', active: true },
            { id: 2, full_name: 'Ayesha Khan', role: 'employee', designation: 'UI/UX Designer', avatar_color: '#3f3f46', active: true },
            { id: 3, full_name: 'Mohammed Irbaz S', role: 'employee', designation: 'Software Engineer', avatar_color: '#1e3a8a', active: true },
          ];
          empData = fallbackProfiles.find((p) => p.id === Number(employee_id)) || {
            id: Number(employee_id),
            full_name: `Employee #${employee_id}`,
            role: 'employee',
            designation: 'Team Member',
            avatar_color: '#3f3f46',
            active: true,
          };
        }

        if (empData.active === false) {
          return res.status(403).json({ error: 'Account is inactive. Please contact the Team Head.' });
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const empIdNum = Number(employee_id);
        const leaderIdNum = Number(leader_id) || 1;
        const markStatus = status || 'present';

        // 3. Check if already marked for today
        const { data: existingRows } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', empIdNum)
          .eq('date', today)
          .limit(1);

        const existing = existingRows && existingRows.length ? existingRows[0] : null;
        const isReMark = Boolean(existing && (existing.status === 'present' || existing.status === 'half'));

        const note = `Marked via QR Scan (${verification.method === 'code' ? 'Code Entry' : 'Camera Scan'}) at ${timeStr}`;
        let savedRow = null;

        if (existing) {
          const { data, error } = await supabase
            .from('attendance')
            .update({
              status: markStatus,
              note,
              marked_by: leaderIdNum,
              updated_at: now.toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          savedRow = data;
        } else {
          const { data, error } = await supabase
            .from('attendance')
            .insert({
              employee_id: empIdNum,
              date: today,
              status: markStatus,
              note,
              marked_by: leaderIdNum,
            })
            .select()
            .single();
          if (error) throw error;
          savedRow = data;
        }

        // Invalidate attendance and stats in server queryCache
        invalidateCache('attendance');
        invalidateCache('stats');

        // 4. Send instant confirmation notification
        try {
          await supabase.from('notifications').insert({
            user_id: empIdNum,
            title: 'Attendance Marked Successfully ✅',
            body: `You checked in as PRESENT today (${today}) at ${timeStr} via Contactless QR.`,
            kind: 'info',
            link: '#/app/sheet',
          });
        } catch (notifErr) {
          console.error('Failed to insert qr notification:', notifErr.message);
        }

        return res.status(200).json({
          ok: true,
          already_marked: false,
          status: markStatus,
          date: today,
          time: timeStr,
          message: isReMark ? 'Check-in time updated successfully!' : 'Attendance marked successfully!',
          employee: empData,
          row: savedRow,
        });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('QR attendance API error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);
