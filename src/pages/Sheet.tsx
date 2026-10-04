import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Printer, Pencil, Check, X, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { monthStrOf, shiftMonth, monthLabel, gradeColor, STATUS_META, type MonthStats, type AttendanceRow } from '../lib/types';

const EDITABLE: string[] = ['present', 'absent', 'half', 'permitted'];

export default function Sheet() {
  const { user } = useAuth();
  const isHead = user?.role === 'head';
  const [month, setMonth] = useState(monthStrOf());
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async (m: string) => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api<MonthStats>(`/api/stats?month=${m}`),
        api<AttendanceRow[]>(`/api/attendance?month=${m}`),
      ]);
      setStats(s); setRows(r); setPending({});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(month); }, [month]);

  const rowMap = useMemo(() => { const m: Record<string, AttendanceRow> = {}; rows.forEach((r) => { m[`${r.employee_id}|${r.date}`] = r; }); return m; }, [rows]);

  const cellStatus = (empId: number, date: string, counts: boolean, isSunday: boolean, override: string | null) => {
    const key = `${empId}|${date}`;
    if (pending[key]) return pending[key];
    const saved = rowMap[key]?.status;
    if (saved) return saved;
    if (!counts) {
      if (override === 'leave_day') return 'leave';
      if (isSunday) return 'sunday';
      return '';
    }
    return '';
  };

  const cycle = (empId: number, day: { date: string; counts: boolean }) => {
    if (!editing || !day.counts) return;
    const key = `${empId}|${day.date}`;
    const cur = pending[key] || rowMap[key]?.status || '';
    const idx = EDITABLE.indexOf(cur);
    const next = idx === -1 ? EDITABLE[0] : EDITABLE[(idx + 1) % EDITABLE.length];
    setPending((p) => ({ ...p, [key]: next }));
  };

  const saveAll = async () => {
    const keys = Object.keys(pending);
    if (!keys.length) { setEditing(false); return; }
    setSaving(true); setMsg(null);
    try {
      let warned = 0;
      for (const key of keys) {
        const [empId, date] = key.split('|');
        const existing = rowMap[key];
        const r = await api<{ row: AttendanceRow; warning: any }>('/api/attendance', {
          method: 'PUT',
          body: existing
            ? { id: existing.id, status: pending[key], marked_by: user!.id }
            : { employee_id: Number(empId), date, status: pending[key], marked_by: user!.id },
        });
        if (r.warning) warned++;
      }
      setMsg(`Saved ${keys.length} change(s)${warned ? ` · ${warned} absence warning email(s) + chat alert(s) sent` : ''}. Scores updated.`);
      setEditing(false);
      await load(month);
    } catch (e: any) { setMsg('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><div className="animate-spin h-10 w-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" /></div>;
  if (!stats) return <p className="text-center py-20 text-zinc-500 dark:text-zinc-400">Failed to load sheet.</p>;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 no-print">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">Attendance Sheet</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isHead ? 'Click a cell to cycle status, then save. Absences trigger warning emails + chat alerts.' : 'Overall team sheet · read-only for employees.'}
            {!isHead && <span className="inline-flex items-center gap-1 ml-2 text-xs font-bold text-zinc-500 dark:text-zinc-400"><Lock size={12} /> View only</span>}
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden w-full sm:w-auto text-zinc-900 dark:text-white">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-[44px] min-h-[44px] flex items-center justify-center"><ChevronLeft size={18} /></button>
            <span className="px-2 text-sm font-bold flex-1 sm:flex-none sm:min-w-[150px] text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-[44px] min-h-[44px] flex items-center justify-center"><ChevronRight size={18} /></button>
          </div>
          <button onClick={() => window.print()} className="hidden sm:block p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-[44px] min-h-[44px]" title="Print sheet"><Printer size={18} /></button>
          {isHead && (!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold px-4 py-2.5 hover:bg-zinc-700 dark:hover:bg-zinc-200 flex-1 sm:flex-none min-h-[44px]"><Pencil size={16} /> Edit Sheet</button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setPending({}); }} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-bold px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-1 sm:flex-none min-h-[44px]"><X size={16} /> Cancel</button>
              <button onClick={saveAll} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-bold px-4 py-2.5 hover:bg-emerald-700 disabled:opacity-60 flex-1 sm:flex-none min-h-[44px]"><Check size={16} /> {saving ? 'Saving…' : `Save (${Object.keys(pending).length})`}</button>
            </>
          ))}
        </div>
      </div>

      {msg && <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-sm font-semibold px-4 py-3 no-print">{msg}</div>}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        {Object.entries(STATUS_META).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-zinc-800 dark:text-zinc-200">
            <span className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-extrabold ${v.cell}`}>{v.short}</span>{v.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-zinc-500 dark:text-zinc-400">— Unmarked</span>
      </div>

      {/* Grid */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-auto scroll-thin max-h-[70vh]">
          <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-zinc-900 dark:bg-zinc-950 text-white text-left px-2 sm:px-4 py-3 font-bold min-w-[132px] sm:min-w-[190px]">Employee \ Day</th>
                {stats.days.map((d) => (
                  <th key={d.date} className={`sheet-cell px-1 py-2 text-center font-bold border-l border-white/10 ${d.override === 'leave_day' ? 'bg-violet-600 text-white' : d.isSunday && !d.counts ? 'bg-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' : d.isSunday ? 'bg-amber-400 text-amber-950' : 'bg-zinc-900 dark:bg-zinc-950 text-white'}`} title={d.label || d.date}>
                    <div className="text-[13px] leading-none">{Number(d.date.slice(8))}</div>
                    <div className="text-[9px] font-semibold opacity-70 mt-0.5">{'SMTWTFS'[d.dow]}</div>
                  </th>
                ))}
                <th className="bg-zinc-900 dark:bg-zinc-950 text-white px-2 py-3 font-bold border-l border-white/10 min-w-[64px]">P</th>
                <th className="bg-zinc-900 dark:bg-zinc-950 text-white px-2 py-3 font-bold min-w-[64px]">A</th>
                <th className="bg-zinc-900 dark:bg-zinc-950 text-white px-2 py-3 font-bold min-w-[64px]">H</th>
                <th className="bg-zinc-900 dark:bg-zinc-950 text-white px-2 py-3 font-bold min-w-[64px]">PL</th>
                <th className="bg-zinc-900 dark:bg-zinc-950 text-white px-3 py-3 font-bold min-w-[90px]">Score</th>
                <th className="bg-zinc-900 dark:bg-zinc-950 text-white px-2 py-3 font-bold min-w-[64px]">Grade</th>
              </tr>
            </thead>
            <tbody>
              {stats.employees.map((e, ri) => {
                const s = stats.stats.find((x) => x.employee_id === e.id)!;
                return (
                  <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ri * 0.02 }} className={ri % 2 ? 'bg-zinc-50/80 dark:bg-zinc-800/40' : 'bg-white dark:bg-zinc-900'}>
                    <td className={`sticky left-0 z-[5] px-2 sm:px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 max-w-[132px] sm:max-w-none ${ri % 2 ? 'bg-zinc-100 dark:bg-zinc-800/90' : 'bg-white dark:bg-zinc-900'}`}>
                      <p className="font-bold text-xs sm:text-[13px] truncate text-zinc-900 dark:text-white">{e.full_name} {s.low && <AlertTriangle size={12} className="inline text-red-500" />}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{e.designation}</p>
                    </td>
                    {stats.days.map((d) => {
                      const st = cellStatus(e.id, d.date, d.counts, d.isSunday, d.override);
                      const meta = st ? STATUS_META[st] : null;
                      const isPending = !!pending[`${e.id}|${d.date}`];
                      return (
                        <td key={d.date} onClick={() => cycle(e.id, d)}
                          className={`sheet-cell text-center px-1 py-1.5 border-l border-b border-zinc-200 dark:border-zinc-800 ${editing && d.counts ? 'cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30' : ''} ${!d.counts ? 'bg-zinc-100/50 dark:bg-zinc-800/20' : ''}`}>
                          {meta ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[9px] sm:text-[10px] font-extrabold ${meta.cell} ${isPending ? 'ring-2 ring-offset-1 ring-zinc-900 dark:ring-zinc-100' : ''}`}>{meta.short}</span>
                          ) : (
                            <span className={`inline-flex w-6 h-6 sm:w-7 sm:h-7 rounded-lg items-center justify-center text-zinc-400 dark:text-zinc-600 ${editing && d.counts ? 'border border-dashed border-zinc-300 dark:border-zinc-700' : ''}`}>–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center font-extrabold text-emerald-700 dark:text-emerald-400 border-b border-zinc-200 dark:border-zinc-800 border-l">{s.present}</td>
                    <td className="text-center font-extrabold text-red-600 dark:text-red-400 border-b border-zinc-200 dark:border-zinc-800">{s.absent}</td>
                    <td className="text-center font-extrabold text-amber-600 dark:text-amber-400 border-b border-zinc-200 dark:border-zinc-800">{s.half}</td>
                    <td className="text-center font-extrabold text-sky-600 dark:text-sky-400 border-b border-zinc-200 dark:border-zinc-800">{s.permitted}</td>
                    <td className="text-center border-b border-zinc-200 dark:border-zinc-800 px-2">
                      <span className={`font-extrabold text-[13px] px-2 py-1 rounded-lg ${s.low ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'}`}>{s.score != null ? `${s.score}%` : '—'}</span>
                    </td>
                    <td className="text-center border-b border-zinc-200 dark:border-zinc-800 px-2">
                      <span className={`text-[11px] font-extrabold border px-2 py-1 rounded-lg ${gradeColor(s.grade)}`}>{s.grade || '—'}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 no-print">
        Scoring: Present & Permitted = 1 pt · Half = 0.5 · Absent = 0 · Sundays & announced leave days are excluded from working days ({stats.workingDays} working days in {monthLabel(month)}). Low-score threshold: below {stats.low_threshold}%.
      </p>
    </div>
  );
}
