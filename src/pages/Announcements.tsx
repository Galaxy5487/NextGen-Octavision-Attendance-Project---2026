import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Send, Trash2, Palmtree, Briefcase, Info, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { fmtTime, type Announcement, type Profile } from '../lib/types';

const KIND_STYLE: Record<string, { bg: string; icon: any; label: string }> = {
  general: { bg: 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900', icon: Info, label: 'General' },
  leave_day: { bg: 'bg-violet-600 text-white', icon: Palmtree, label: 'Leave' },
  sunday_working: { bg: 'bg-amber-400 text-amber-950', icon: Briefcase, label: 'Working Sunday' },
};

export default function Announcements() {
  const { user } = useAuth();
  const isHead = user?.role === 'head';
  const [list, setList] = useState<Announcement[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const hideAnnouncement = (id: number) => {
    setDismissed((prev) => [...prev, id]);
  };

  const filteredList = list.filter((a) => !dismissed.includes(a.id));

  const load = async () => {
    try {
      const [a, p] = await Promise.all([api<Announcement[]>('/api/announcements?limit=60'), api<Profile[]>('/api/employees')]);
      setList(a); setPeople(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await api('/api/announcements', { method: 'POST', body: { title: title.trim(), body: body.trim(), kind: 'general', created_by: user!.id } });
      setTitle(''); setBody('');
      await load();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    await api('/api/announcements', { method: 'DELETE', body: { id } });
    load();
  };

  const clearAllAnnouncements = async () => {
    if (!confirm('Clear all announcements for the team?')) return;
    try {
      await api('/api/announcements', { method: 'DELETE', body: { clear_all: true } });
      load();
    } catch (e: any) {
      alert('Failed to clear announcements: ' + e.message);
    }
  };

  const byName = (id: number | null) => people.find((p) => p.id === id)?.full_name || 'Team Head';

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 text-zinc-900 dark:text-white"><Megaphone size={22} /> Announcements</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{isHead ? 'Broadcast to the whole team — everyone gets notified.' : 'Updates from your team head.'}</p>
        </div>
        {isHead && list.length > 0 && (
          <button onClick={clearAllAnnouncements} title="Clear all announcements" className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold px-3 py-2.5 transition min-h-[44px] shrink-0">
            <Trash2 size={15} /> Clear All
          </button>
        )}
      </div>

      {isHead && (
        <form onSubmit={submit} className="bg-zinc-950 dark:bg-zinc-900 text-white rounded-3xl p-5 sm:p-6 relative overflow-hidden shadow-xl border border-zinc-800">
          <div className="absolute inset-0 login-grid-bg opacity-50" />
          <div className="relative">
            <p className="font-bold text-sm tracking-wide text-white">📢 New Announcement</p>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline…" className="mt-3 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-white/40" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the full message for the team…" rows={3} className="mt-2 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-white/40" />
            <button disabled={busy} className="mt-3 rounded-xl bg-white text-zinc-900 font-extrabold px-5 py-2.5 text-sm hover:bg-zinc-200 transition flex items-center gap-2 disabled:opacity-60 shadow-sm">
              <Send size={15} /> {busy ? 'Publishing…' : 'Publish to Team'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" /></div>
      ) : filteredList.length === 0 ? (
        <p className="text-center text-zinc-500 dark:text-zinc-400 py-12">No announcements visible.</p>
      ) : (
        <div className="space-y-3">
          {filteredList.map((a, i) => {
            const ks = KIND_STYLE[a.kind] || KIND_STYLE.general;
            const Icon = ks.icon;
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm text-zinc-900 dark:text-white">
                <div className="flex items-start gap-3">
                  <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${ks.bg}`}><Icon size={18} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-zinc-900 dark:text-white">{a.title}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">{ks.label}</span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1.5 whitespace-pre-wrap leading-relaxed">{a.body}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">By {byName(a.created_by)} · {fmtTime(a.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => hideAnnouncement(a.id)} title="Hide/Dismiss announcement" className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                      <EyeOff size={16} />
                    </button>
                    {isHead && (
                      <button onClick={() => del(a.id)} title="Delete announcement for all" className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
