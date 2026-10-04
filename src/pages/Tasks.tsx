import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, Trash2, X, Flag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { todayStr, type Task, type Profile } from '../lib/types';

const COLS: { id: Task['status']; label: string; color: string }[] = [
  { id: 'pending', label: 'Pending', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300' },
  { id: 'done', label: 'Done', color: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' },
];
const PRI: Record<string, string> = {
  high: 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300',
  medium: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300',
  low: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
};

export default function Tasks() {
  const { user } = useAuth();
  const isHead = user?.role === 'head';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', due_date: '', priority: 'medium' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [t, p] = await Promise.all([
        api<Task[]>(isHead ? '/api/tasks' : `/api/tasks?assignee_id=${user!.id}`),
        api<Profile[]>('/api/employees'),
      ]);
      setTasks(t); setPeople(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const move = async (id: number, status: Task['status']) => {
    await api('/api/tasks', { method: 'PUT', body: { id, status } });
    load();
  };
  const del = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    await api('/api/tasks', { method: 'DELETE', body: { id } });
    load();
  };
  const clearDone = async () => {
    if (!confirm('Clear all completed tasks?')) return;
    try {
      await api('/api/tasks', { method: 'DELETE', body: { clear_done: true, assignee_id: isHead ? undefined : user!.id } });
      load();
    } catch (e: any) { alert(e.message); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.assignee_id) return;
    setBusy(true);
    try {
      await api('/api/tasks', { method: 'POST', body: { title: form.title.trim(), description: form.description.trim(), assignee_id: Number(form.assignee_id), assigned_by: user!.id, due_date: form.due_date || null, priority: form.priority } });
      setShow(false);
      setForm({ title: '', description: '', assignee_id: '', due_date: '', priority: 'medium' });
      load();
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  };

  const name = (id: number) => people.find((p) => p.id === id)?.full_name || `#${id}`;
  const overdue = (t: Task) => t.due_date && t.due_date < todayStr() && t.status !== 'done';
  const hasDone = tasks.some((t) => t.status === 'done');

  if (loading) return <div className="flex justify-center py-24"><div className="animate-spin h-10 w-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 text-zinc-900 dark:text-white"><ClipboardList size={22} /> {isHead ? 'Tasks' : 'My Tasks'}</h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">{isHead ? 'Assign work — especially improvement tasks for low scorers.' : 'Work assigned by your team head.'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {hasDone && (
            <button onClick={clearDone} title="Clear all completed tasks" className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold px-3 py-2.5 transition min-h-[44px]">
              <Trash2 size={15} /> Clear Completed
            </button>
          )}
          {isHead && (
            <button onClick={() => setShow(true)} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold px-3 sm:px-4 py-2.5 hover:bg-zinc-700 dark:hover:bg-zinc-200 shrink-0 min-h-[44px]"><Plus size={16} /> <span className="hidden sm:inline">Assign Task</span><span className="sm:hidden">Assign</span></button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 items-start">
        {COLS.map((c) => {
          const items = tasks.filter((t) => t.status === c.id);
          return (
            <div key={c.id} className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-3 min-h-[200px]">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${c.color}`}>{c.label}</span>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{items.length}</span>
              </div>
              <div className="space-y-2.5 mt-2">
                {items.map((t) => (
                  <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`bg-white dark:bg-zinc-900 rounded-xl border p-3.5 shadow-sm ${overdue(t) ? 'border-red-300 dark:border-red-800' : 'border-zinc-200 dark:border-zinc-800'}`}>
                    <div className="flex items-start gap-2">
                      <p className="font-bold text-sm flex-1 text-zinc-900 dark:text-white">{t.title}</p>
                      <button onClick={() => del(t.id)} title="Delete task" className="text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition shrink-0"><Trash2 size={14} /></button>
                    </div>
                    {t.description && <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{t.description}</p>}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${PRI[t.priority]}`}><Flag size={10} />{t.priority}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">👤 {name(t.assignee_id)}</span>
                      {t.due_date && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${overdue(t) ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300'}`}>📅 {t.due_date}{overdue(t) ? ' OVERDUE' : ''}</span>}
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      {c.id === 'pending' && <button onClick={() => move(t.id, 'in_progress')} className="flex-1 text-xs font-bold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-1.5 hover:bg-zinc-700 dark:hover:bg-zinc-200">Start ▶</button>}
                      {c.id === 'in_progress' && (
                        <>
                          <button onClick={() => move(t.id, 'pending')} className="flex-1 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">◀ Back</button>
                          <button onClick={() => move(t.id, 'done')} className="flex-1 text-xs font-bold rounded-lg bg-emerald-600 text-white py-1.5 hover:bg-emerald-700">Done ✓</button>
                        </>
                      )}
                      {c.id === 'done' && <button onClick={() => move(t.id, 'in_progress')} className="flex-1 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">Reopen</button>}
                    </div>
                  </motion.div>
                ))}
                {items.length === 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-6">Nothing here</p>}
              </div>
            </div>
          );
        })}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShow(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-lg">Assign Task</h3>
              <button type="button" onClick={() => setShow(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-3 mt-4">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title *" className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details / instructions…" rows={3} className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" />
              <select required value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })} className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100">
                <option value="">Select employee *</option>
                {people.filter((p) => p.role === 'employee').map((p) => <option key={p.id} value={p.id}>{p.full_name} — {p.designation}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.due_date} min={todayStr()} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm" />
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <button disabled={busy} className="mt-4 w-full rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold py-3 text-sm hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-60">{busy ? 'Assigning…' : 'Assign Task'}</button>
          </form>
        </div>
      )}
    </div>
  );
}
