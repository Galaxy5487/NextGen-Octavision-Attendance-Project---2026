import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarCheck2, UserCheck, UserX, Plane, ChevronRight, TrendingUp,
  MessagesSquare, ClipboardList, Megaphone, Flame, Award, Clock, Bell,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { monthStrOf, fmtDate, todayStr, monthLabel, STATUS_META, gradeColor, type MonthStats, type Announcement, type AttendanceRow, type Task, type LeaveRequest } from '../lib/types';
import UserAvatar from '../components/UserAvatar';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm ${className}`}>{children}</div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const isHead = user?.role === 'head';
  const [month] = useState(monthStrOf());
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [todayRows, setTodayRows] = useState<AttendanceRow[]>([]);
  const [ann, setAnn] = useState<Announcement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, t, a, tk, lv] = await Promise.all([
          api<MonthStats>(`/api/stats?month=${month}`),
          api<AttendanceRow[]>(`/api/attendance?date=${todayStr()}`),
          api<Announcement[]>('/api/announcements?limit=4'),
          api<Task[]>(isHead ? '/api/tasks' : `/api/tasks?assignee_id=${user!.id}`),
          api<LeaveRequest[]>(isHead ? '/api/leaves?status=pending' : `/api/leaves?employee_id=${user!.id}`),
        ]);
        setStats(s); setTodayRows(t); setAnn(a);
        setTasks(tk);
        setLeaves(lv);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const myStat = useMemo(() => stats?.stats.find((s) => s.employee_id === user?.id), [stats, user]);
  const todayMap = useMemo(() => { const m: Record<number, string> = {}; todayRows.forEach((r) => { m[r.employee_id] = r.status; }); return m; }, [todayRows]);
  const presentToday = todayRows.filter((r) => r.status === 'present' || r.status === 'permitted').length;
  const absentToday = todayRows.filter((r) => r.status === 'absent').length;
  const pendingTasks = (isHead ? (tasks as Task[]) : tasks).filter((t) => t.status !== 'done');
  const lowScorers = useMemo(() => (stats?.stats || []).filter((s) => s.low), [stats]);
  const topScorers = useMemo(() => [...(stats?.stats || [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 5), [stats]);
  const empName = (id: number) => stats?.employees.find((e) => e.id === id)?.full_name || `#${id}`;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin h-10 w-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" />
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 dark:from-zinc-950 dark:via-black dark:to-zinc-950 text-white p-5 sm:p-8 shadow-xl">
        <div className="absolute inset-0 login-grid-bg opacity-40" />
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <img src="/logo.png" alt="" className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover bg-white ring-2 ring-white/20 shrink-0 shadow-md" />
          <div className="flex-1">
            <p className="text-xs tracking-[0.25em] text-zinc-400 font-bold uppercase">{monthLabel(month)} · {fmtDate(todayStr())}</p>
            <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
              {isHead ? 'Agency attendance at a glance' : (myStat?.score != null ? `Your score: ${myStat.score}%` : 'Your attendance hub')}
            </h1>
            <p className="text-sm text-zinc-300 dark:text-zinc-400 mt-1">
              {isHead
                ? `${stats?.employees.length || 0} employees · ${stats?.workingDays || 0} working days this month · ${lowScorers.length} need attention`
                : `Grade ${myStat?.grade || '—'} · ${myStat?.present || 0} present · ${myStat?.absent || 0} absent · ${myStat?.permitted || 0} permitted`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link to="/app/sheet" className="rounded-xl bg-white text-zinc-900 text-sm font-extrabold px-5 py-3 hover:bg-zinc-200 transition text-center shadow-md">View Sheet</Link>
            {isHead && <Link to="/app/mark" className="rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold px-5 py-3 transition border border-white/20 text-center">Mark Today</Link>}
          </div>
        </div>
      </motion.div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: UserCheck, label: 'Present Today', val: presentToday, sub: `${todayRows.length} marked`, c: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' },
          { icon: UserX, label: 'Absent Today', val: absentToday, sub: 'warnings auto-sent', c: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50' },
          { icon: Plane, label: isHead ? 'Pending Leaves' : 'My Leave Requests', val: leaves.length, sub: isHead ? 'awaiting decision' : 'total submitted', c: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50' },
          { icon: ClipboardList, label: isHead ? 'Open Tasks' : 'My Open Tasks', val: pendingTasks.length, sub: 'pending + in progress', c: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
            <Card className="p-3.5 sm:p-5">
              <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center ${s.c}`}><s.icon size={20} /></div>
              <p className="mt-3 text-xl sm:text-3xl font-extrabold font-display text-zinc-900 dark:text-white">{s.val}</p>
              <p className="text-[13px] sm:text-sm font-bold text-zinc-800 dark:text-zinc-200">{s.label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.sub}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Today roster */}
        <Card className="p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-extrabold text-lg flex items-center gap-2 text-zinc-900 dark:text-white"><CalendarCheck2 size={19} /> Today's Roster</h3>
            {isHead && <Link to="/app/mark" className="text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">Mark <ChevronRight size={16} /></Link>}
          </div>
          <div className="space-y-2 max-h-[340px] overflow-y-auto scroll-thin pr-1">
            {(stats?.employees || []).map((e) => {
              const st = todayMap[e.id];
              const meta = st ? STATUS_META[st] : null;
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                  <UserAvatar p={e} size="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate text-zinc-900 dark:text-white">{e.full_name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{e.designation}</p>
                  </div>
                  {meta ? (
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cell}`}>{meta.label}</span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><Clock size={12} /> Unmarked</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4 sm:space-y-6">
          {/* Leaderboard */}
          <Card className="p-4 sm:p-6">
            <h3 className="font-display font-extrabold text-lg flex items-center gap-2 mb-4 text-zinc-900 dark:text-white"><Award size={19} /> Top Scores</h3>
            <div className="space-y-3">
              {topScorers.map((s, i) => (
                <div key={s.employee_id} className="flex items-center gap-3">
                  <span className={`text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center ${i === 0 ? 'bg-amber-400 text-amber-950 font-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-bold truncate text-zinc-900 dark:text-white">{empName(s.employee_id)}</p>
                      <p className="text-sm font-extrabold text-zinc-900 dark:text-white">{s.score != null ? `${s.score}%` : '—'}</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 mt-1.5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${s.score ?? 0}%` }} transition={{ delay: 0.2 + i * 0.08 }} className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Low scorers */}
          {isHead && lowScorers.length > 0 && (
            <Card className="p-4 sm:p-6 border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20">
              <h3 className="font-display font-extrabold text-lg flex items-center gap-2 mb-3 text-red-800 dark:text-red-400"><Flame size={19} /> Needs Attention</h3>
              {lowScorers.slice(0, 4).map((s) => (
                <div key={s.employee_id} className="flex items-center justify-between py-1.5">
                  <p className="text-sm font-bold truncate text-zinc-900 dark:text-white">{empName(s.employee_id)}</p>
                  <span className={`text-xs font-bold border px-2 py-0.5 rounded-full ${gradeColor(s.grade)}`}>{s.score}% · {s.grade}</span>
                </div>
              ))}
              <Link to="/app/scores" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">Assign tasks <ChevronRight size={15} /></Link>
            </Card>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Announcements */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-extrabold text-lg flex items-center gap-2 text-zinc-900 dark:text-white"><Megaphone size={19} /> Latest Announcements</h3>
            <Link to="/app/announcements" className="text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">All <ChevronRight size={16} /></Link>
          </div>
          <div className="space-y-3">
            {ann.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No announcements yet.</p>}
            {ann.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-3.5">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">{a.title}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">{a.body}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick links */}
        <Card className="p-4 sm:p-6">
          <h3 className="font-display font-extrabold text-lg flex items-center gap-2 mb-4 text-zinc-900 dark:text-white"><TrendingUp size={19} /> Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {[
              { to: '/app/sheet', icon: CalendarCheck2, t: 'Attendance Sheet', d: 'Monthly grid + scores' },
              { to: '/app/chat', icon: MessagesSquare, t: 'Team Chat', d: 'DMs & groups' },
              ...(isHead
                ? [
                  { to: '/app/scores', icon: TrendingUp, t: 'Scores & Tasks', d: 'Fix low scores' },
                  { to: '/app/calendar', icon: Bell, t: 'Calendar Control', d: 'Sundays & leaves' },
                ]
                : [
                  { to: '/app/leaves', icon: Plane, t: 'Request Leave', d: 'Permission leaves' },
                  { to: '/app/tasks', icon: ClipboardList, t: 'My Tasks', d: `${pendingTasks.length} open` },
                ]),
            ].map((q) => (
              <Link key={q.to + q.t} to={q.to} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 hover:border-zinc-900 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition group">
                <q.icon size={20} className="text-zinc-800 dark:text-zinc-200 group-hover:scale-110 transition" />
                <p className="text-sm font-bold mt-2 text-zinc-900 dark:text-white">{q.t}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{q.d}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
