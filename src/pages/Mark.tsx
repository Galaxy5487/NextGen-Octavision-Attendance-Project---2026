import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { fmtDate, todayStr, STATUS_META, type Profile, type AttendanceRow, type CalendarOverride } from '../lib/types';
import UserAvatar from '../components/UserAvatar';

const ORDER = ['present', 'half', 'permitted', 'absent'];

function shiftDate(ds: string, delta: number) {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function Mark() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [overrides, setOverrides] = useState<CalendarOverride[]>([]);
  const [sel, setSel] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async (ds: string) => {
    setLoading(true); setMsg(null);
    try {
      const [emps, r, ov] = await Promise.all([
        api<Profile[]>('/api/employees'),
        api<AttendanceRow[]>(`/api/attendance?date=${ds}`),
        api<CalendarOverride[]>(`/api/calendar?from=${ds}&to=${ds}`),
      ]);
      const act = emps.filter((e) => e.role === 'employee' && e.active);
      setEmployees(act); setRows(r); setOverrides(ov);
      const m: Record<number, string> = {}; const n: Record<number, string> = {};
      r.forEach((x) => { m[x.employee_id] = x.status; if (x.note) n[x.employee_id] = x.note; });
      setSel(m); setNotes(n);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(date); }, [date]);

  const dow = useMemo(() => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }, [date]);
  const ov = overrides[0];
  const isLeaveDay = ov?.kind === 'leave_day';
  const isSunday = dow === 0;
  const counts = !isLeaveDay && (!isSunday || ov?.kind === 'sunday_working');

  const setAll = (status: string) => {
    const m: Record<number, string> = {};
    employees.forEach((e) => { m[e.id] = status; });
    setSel(m);
  };

  const save = async () => {
    const entries = employees.filter((e) => sel[e.id]).map((e) => ({ employee_id: e.id, status: sel[e.id], note: notes[e.id] || '' }));
    if (!entries.length) { setMsg('Select a status for at least one employee.'); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await api<{ saved: number; warnings: any[] }>('/api/attendance', { method: 'POST', body: { date, entries, marked_by: user!.id } });
      setMsg(`Saved attendance for ${r.saved} employee(s)${r.warnings?.length ? ` · ⚠️ ${r.warnings.length} absence warning email(s) + chat notification(s) sent` : ''}.`);
      await load(date);
    } catch (e: any) { setMsg('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><div className="animate-spin h-10 w-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" /></div>;

  return (
    <div className="space-y-5 max-w-5xl text-zinc-900 dark:text-white">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2"><CalendarDays size={22} /> Log Attendance</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Mark the whole team for one day. Absences auto-send warning emails + chat alerts.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden w-full sm:w-auto bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
          <button onClick={() => setDate(shiftDate(date, -1))} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-w-[44px] min-h-[44px] flex items-center justify-center"><ChevronLeft size={18} /></button>
          <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="px-2 py-2 text-sm font-bold bg-transparent focus:outline-none flex-1 sm:flex-none" />
          <button onClick={() => setDate(shiftDate(date, 1))} disabled={date >= todayStr()} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"><ChevronRight size={18} /></button>
        </div>
        <p className="text-sm font-bold">{fmtDate(date)}</p>
        <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
          {!counts && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
              {isLeaveDay ? `🏖️ Announced leave (${ov?.label || 'office closed'})` : '⛱️ Sunday — auto leave'}
            </span>
          )}
          {isSunday && ov?.kind === 'sunday_working' && <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">💼 Working Sunday</span>}
          <button onClick={() => setAll('present')} className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">All Present</button>
          <button onClick={() => setDate(todayStr())} className="text-xs font-bold px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200">Today</button>
        </div>
      </div>

      {msg && <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-sm font-semibold px-4 py-3">{msg}</div>}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
        {employees.map((e) => (
          <div key={e.id} className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-3 md:w-64 shrink-0">
              <UserAvatar p={e} size="h-10 w-10 text-xs" />
              <div className="min-w-0">
                <p className="text-sm font-bold truncate text-zinc-900 dark:text-white">{e.full_name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{e.designation}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ORDER.map((st) => {
                const meta = STATUS_META[st];
                const active = sel[e.id] === st;
                return (
                  <button key={st} onClick={() => setSel((s) => ({ ...s, [e.id]: st }))}
                    className={`text-xs font-bold px-3.5 py-2.5 rounded-xl border transition min-h-[40px] ${active ? meta.cell + ' border-transparent shadow' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'}`}>
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <input value={notes[e.id] || ''} onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))} placeholder="Note (optional)"
              className="md:ml-auto md:w-52 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" />
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} className="w-full rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold py-4 text-sm hover:bg-zinc-700 dark:hover:bg-zinc-200 transition flex items-center justify-center gap-2 disabled:opacity-60">
        {saving ? <span className="animate-spin h-4 w-4 rounded-full border-2 border-white/40 border-t-white" /> : <Send size={17} />}
        {saving ? 'Saving…' : `Save Attendance for ${fmtDate(date)}`}
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5"><CheckCircle2 size={13} /> Every new "Absent" marking instantly emails the employee (full name + score) and posts a chat warning.</p>
    </div>
  );
}
