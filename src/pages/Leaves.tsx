import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plane, Plus, Check, X, CalendarRange, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { type LeaveRequest, type Profile } from '../lib/types';
import UserAvatar from '../components/UserAvatar';

const ST: Record<string, string> = {
  pending: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300',
  permitted: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300',
  denied: 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300',
};

export default function Leaves() {
  const { user } = useAuth();
  const isHead = user?.role === 'head';
  const [list, setList] = useState<LeaveRequest[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ from_date: '', to_date: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      const [l, p] = await Promise.all([
        api<LeaveRequest[]>(isHead ? '/api/leaves' : `/api/leaves?employee_id=${user!.id}`),
        api<Profile[]>('/api/employees'),
      ]);
      setList(l); setPeople(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.from_date || !form.to_date || !form.reason.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await api('/api/leaves', { method: 'POST', body: { employee_id: user!.id, from_date: form.from_date, to_date: form.to_date, reason: form.reason.trim() } });
      setMsg('Leave request submitted — your team head will review it.');
      setShow(false);
      setForm({ from_date: '', to_date: '', reason: '' });
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const decide = async (id: number, status: 'permitted' | 'denied') => {
    setBusy(true);
    try {
      await api('/api/leaves', { method: 'PUT', body: { id, status, decided_by: user!.id } });
      setMsg(status === 'permitted' ? 'Leave permitted — attendance marked as Permitted (counts toward score).' : 'Leave request denied.');
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const deleteLeave = async (id: number) => {
    if (!confirm('Delete this leave request?')) return;
    try {
      await api('/api/leaves', { method: 'DELETE', body: { id } });
      load();
    } catch (e: any) { setMsg(e.message); }
  };

  const clearProcessed = async () => {
    if (!confirm('Clear all decided/processed leave requests?')) return;
    try {
      await api('/api/leaves', { method: 'DELETE', body: { clear_processed: true } });
      load();
    } catch (e: any) { setMsg(e.message); }
  };

  const name = (id: number) => people.find((p) => p.id === id);
  const pend = list.filter((l) => l.status === 'pending');
  const done = list.filter((l) => l.status !== 'pending');

  if (loading) return <div className="flex justify-center py-24"><div className="animate-spin h-10 w-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" /></div>;

  const card = (l: LeaveRequest) => {
    const p = name(l.employee_id);
    return (
      <motion.div key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm text-zinc-900 dark:text-white">
        <div className="flex items-start gap-3">
          <UserAvatar p={p} size="h-10 w-10 text-xs" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm text-zinc-900 dark:text-white">{p?.full_name || `#${l.employee_id}`}</p>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${ST[l.status]}`}>{l.status}</span>
            </div>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5"><CalendarRange size={13} /> {l.from_date} → {l.to_date}</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-2 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800">“{l.reason}”</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">Requested {new Date(l.created_at).toLocaleString()}</p>
          </div>
          <button onClick={() => deleteLeave(l.id)} title="Delete request" className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
            <Trash2 size={16} />
          </button>
        </div>
        {isHead && l.status === 'pending' && (
          <div className="flex gap-2 mt-4">
            <button onClick={() => decide(l.id, 'permitted')} disabled={busy} className="flex-1 rounded-xl bg-emerald-600 text-white text-sm font-bold py-2.5 hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-1.5"><Check size={16} /> Permit Leave</button>
            <button onClick={() => decide(l.id, 'denied')} disabled={busy} className="flex-1 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-bold py-2.5 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60 flex items-center justify-center gap-1.5"><X size={16} /> Deny</button>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 text-zinc-900 dark:text-white"><Plane size={22} /> Permission Leaves</h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">{isHead ? 'Review requests — permitting auto-marks attendance as Permitted.' : 'Request time off — permitted leaves keep your score safe.'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {done.length > 0 && (
            <button onClick={clearProcessed} title="Clear processed leaves" className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold px-3 py-2.5 transition min-h-[44px]">
              <Trash2 size={15} /> Clear Processed
            </button>
          )}
          {!isHead && (
            <button onClick={() => setShow(true)} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold px-3 sm:px-4 py-2.5 hover:bg-zinc-700 dark:hover:bg-zinc-200 shrink-0 min-h-[44px]"><Plus size={16} /> <span className="hidden sm:inline">Request Leave</span><span className="sm:hidden">Request</span></button>
          )}
        </div>
      </div>

      {msg && <div className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 text-sm font-semibold px-4 py-3">{msg}</div>}

      {isHead && (
        <>
          <h2 className="font-bold text-sm uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pending ({pend.length})</h2>
          {pend.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">No pending requests. 🎉</p> : <div className="space-y-3">{pend.map(card)}</div>}
          <h2 className="font-bold text-sm uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pt-2">Decided ({done.length})</h2>
          {done.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing decided yet.</p> : <div className="space-y-3">{done.map(card)}</div>}
        </>
      )}
      {!isHead && (
        <div className="space-y-3">
          {list.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">No leave requests yet. Click “Request Leave” to apply.</p>}
          {list.map(card)}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShow(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <h3 className="font-display font-extrabold text-lg">Request Permission Leave</h3>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">FROM</label>
                <input type="date" required value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">TO</label>
                <input type="date" required value={form.to_date} min={form.from_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" />
              </div>
            </div>
            <textarea required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for leave…" rows={3} className="mt-3 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShow(false)} className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 font-bold py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200">Cancel</button>
              <button disabled={busy} className="flex-1 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold py-3 text-sm hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-60">{busy ? 'Sending…' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
