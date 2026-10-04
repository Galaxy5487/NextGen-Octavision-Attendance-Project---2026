import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MailWarning, Mail, Send, ChevronDown, BadgeCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { todayStr, type WarningLog, type Profile } from '../lib/types';

export default function Warnings() {
  const { user } = useAuth();
  const isHead = user?.role === 'head';
  const [logs, setLogs] = useState<WarningLog[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ employee_id: '', date: todayStr(), custom_note: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [w, p] = await Promise.all([
        api<WarningLog[]>(isHead ? '/api/warnings' : `/api/warnings?employee_id=${user!.id}`),
        api<Profile[]>('/api/employees'),
      ]);
      setLogs(w); setPeople(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.date) return;
    setBusy(true);
    try {
      await api('/api/warnings', { method: 'POST', body: { employee_id: Number(form.employee_id), date: form.date, custom_note: form.custom_note.trim() || null, sent_by: user!.id } });
      setShow(false);
      setForm({ employee_id: '', date: todayStr(), custom_note: '' });
      load();
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  };

  const delWarning = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Delete this warning log entry?')) return;
    try {
      await api('/api/warnings', { method: 'DELETE', body: { id } });
      load();
    } catch (err: any) { alert(err.message); }
  };

  const clearAllWarnings = async () => {
    if (!confirm('Are you sure you want to clear warning history?')) return;
    try {
      await api('/api/warnings', { method: 'DELETE', body: { employee_id: isHead ? undefined : user!.id, clear_all: true } });
      load();
    } catch (err: any) { alert(err.message); }
  };

  const emp = (id: number) => people.find((p) => p.id === id);

  if (loading) return <div className="flex justify-center py-24"><div className="animate-spin h-10 w-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" /></div>;

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl text-zinc-900 dark:text-white">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2"><MailWarning size={22} /> Warning Emails</h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {isHead ? 'Every absence emails the employee (full name + score) and posts a chat alert. Full log below.' : 'Warnings issued for your absences. Each email shows your full name and score.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {logs.length > 0 && (
            <button onClick={clearAllWarnings} title="Clear warning history" className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold px-3 py-2.5 transition min-h-[44px]">
              <Trash2 size={15} /> Clear History
            </button>
          )}
          {isHead && (
            <button onClick={() => setShow(true)} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white text-sm font-bold px-3 sm:px-4 py-2.5 hover:bg-red-700 shrink-0 min-h-[44px]">
              <Send size={15} /> <span className="hidden sm:inline">Send Warning</span><span className="sm:hidden">Warn</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { l: 'Total warnings', v: logs.length },
          { l: 'This month', v: logs.filter((w) => w.date.slice(0, 7) === todayStr().slice(0, 7)).length },
          { l: 'Employees warned', v: new Set(logs.map((w) => w.employee_id)).size },
        ].map((s) => (
          <div key={s.l} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 text-center">
            <p className="font-display text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white">{s.v}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">{s.l}</p>
          </div>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-10 text-center">
          <Mail size={36} className="mx-auto text-zinc-400 dark:text-zinc-500" />
          <p className="font-bold mt-3 text-zinc-900 dark:text-white">No warnings {isHead ? 'sent yet' : 'for you'} 🎉</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{isHead ? 'Mark someone absent and a warning email + chat alert fires automatically.' : 'Keep up the great attendance!'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((w) => {
            const p = emp(w.employee_id);
            const isOpen = open === w.id;
            return (
              <motion.div key={w.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div onClick={() => setOpen(isOpen ? null : w.id)} className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition cursor-pointer select-none">
                  <span className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0"><MailWarning size={18} className="text-red-600 dark:text-red-400" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate text-zinc-900 dark:text-white">{w.subject}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">To: {p?.full_name} ({p?.email}) · Score at send: <b className="text-zinc-800 dark:text-zinc-200">{w.score_snapshot}%</b></p>
                  </div>
                  <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${w.email_status === 'sent' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'}`}>
                    {w.email_status === 'sent' ? '✉️ SENT' : '📝 LOGGED'}
                  </span>
                  <button onClick={(e) => delWarning(e, w.id)} title="Delete warning log" className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                    <Trash2 size={16} />
                  </button>
                  <ChevronDown size={17} className={`shrink-0 text-zinc-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mx-4 mb-4 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                        <div className="bg-zinc-950 dark:bg-zinc-950 text-white px-5 py-4">
                          <p className="font-display font-extrabold text-white">NextGen Octavision</p>
                          <p className="text-[10px] tracking-[0.3em] text-zinc-400 font-bold">CREATE – INNOVATE – EVOLVE</p>
                        </div>
                        <div className="p-5 bg-zinc-50 dark:bg-zinc-800/40">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">To: <b className="text-zinc-800 dark:text-zinc-200">{p?.email}</b> · Date: {w.date}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Subject: <b className="text-zinc-800 dark:text-zinc-200">{w.subject}</b></p>
                          <div className="mt-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 text-sm leading-relaxed whitespace-pre-wrap text-zinc-900 dark:text-white">{w.body}</div>
                          <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><BadgeCheck size={13} /> Chat notification was also posted to {p?.full_name?.split(' ')[0]}'s Attendance Alerts thread.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" onClick={() => setShow(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <h3 className="font-display font-extrabold text-lg">Send Manual Warning</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Email includes the employee's full name + current score; a chat alert is posted too.</p>
            <select required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="mt-4 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100">
              <option value="">Select employee *</option>
              {people.filter((p) => p.role === 'employee' && p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <input type="date" required value={form.date} max={todayStr()} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm" />
            <textarea value={form.custom_note} onChange={(e) => setForm({ ...form, custom_note: e.target.value })} placeholder="Personal note from team head (optional)…" rows={3} className="mt-2 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShow(false)} className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 font-bold py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200">Cancel</button>
              <button disabled={busy} className="flex-1 rounded-xl bg-red-600 text-white font-bold py-3 text-sm hover:bg-red-700 disabled:opacity-60">{busy ? 'Sending…' : 'Send Warning'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
