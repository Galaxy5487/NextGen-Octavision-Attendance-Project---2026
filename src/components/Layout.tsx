import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CalendarCheck2, CalendarDays, Megaphone, MessagesSquare,
  ClipboardList, Plane, MailWarning, Users, Bell, LogOut, Menu, X, CheckCheck, Settings as SettingsIcon, Trash2, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Notif } from '../lib/types';
import UserAvatar from '../components/UserAvatar';
import { api } from '../lib/api';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/sheet', label: 'Attendance Sheet', icon: CalendarCheck2 },
  { to: '/app/mark', label: 'Mark Attendance', icon: CalendarDays, head: true },
  { to: '/app/scores', label: 'Scores', icon: ClipboardList, head: true },
  { to: '/app/tasks', label: 'Tasks', icon: ClipboardList, emp: true },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/app/chat', label: 'Chat', icon: MessagesSquare },
  { to: '/app/leaves', label: 'Leave Requests', icon: Plane },
  { to: '/app/warnings', label: 'Warning Emails', icon: MailWarning },
  { to: '/app/team', label: 'Team', icon: Users, head: true },
  { to: '/app/settings', label: 'Profile Settings', icon: SettingsIcon },
];

const KIND_ICON: Record<string, string> = {
  warning: '⚠️', announcement: '📢', chat: '💬', task: '📌', leave: '🛫', info: '🔔',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const isHead = user?.role === 'head';

  const fetchNotifs = async () => {
    if (!user) return;
    try { setNotifs(await api<Notif[]>(`/api/notifications?user_id=${user.id}&limit=40`)); } catch {}
  };
  useEffect(() => { fetchNotifs(); const t = setInterval(fetchNotifs, 15000); return () => clearInterval(t); }, [user?.id]);

  const unread = notifs.filter((n) => !n.read).length;

  const markAll = async () => {
    if (!user) return;
    await api('/api/notifications', { method: 'PUT', body: { user_id_all: user.id } });
    fetchNotifs();
  };

  const deleteNotif = async (id: number) => {
    try {
      await api('/api/notifications', { method: 'DELETE', body: { id } });
      fetchNotifs();
    } catch (e: any) { alert('Failed to clear reminder: ' + e.message); }
  };

  const clearAllNotifs = async () => {
    if (!user) return;
    if (!confirm('Clear all notifications & reminders?')) return;
    try {
      await api('/api/notifications', { method: 'DELETE', body: { user_id: user.id } });
      fetchNotifs();
    } catch (e: any) { alert('Failed to clear reminders: ' + e.message); }
  };

  const openNotif = async (n: Notif) => {
    if (!n.read) { await api('/api/notifications', { method: 'PUT', body: { id: n.id } }); fetchNotifs(); }
    setShowNotif(false);
    if (n.link && n.link.startsWith('#')) nav(n.link.slice(1));
  };

  const items = NAV.filter((i) => {
    if (i.head && !isHead) return false;
    if (i.emp && isHead) return false;
    if (i.to === '/app/tasks' && isHead) return true;
    return true;
  });

  const sidebar = (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
      <Link to="/app" className="flex items-center gap-3 px-5 pt-6 pb-5" onClick={() => setOpen(false)}>
        <img src="/logo.png" alt="NextGen Octavision" className="h-11 w-11 rounded-xl object-cover bg-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700" />
        <div>
          <p className="font-display font-extrabold text-[15px] leading-tight tracking-tight text-zinc-900 dark:text-white">NextGen Octavision</p>
          <p className="text-[10px] tracking-[0.18em] text-zinc-500 font-semibold dark:text-zinc-400">CREATE – INNOVATE – EVOLVE</p>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scroll-thin">
        {items.map((i) => {
          const active = i.end ? loc.pathname === '/app' : loc.pathname.startsWith(i.to);
          const Icon = i.icon;
          return (
            <Link key={i.to + i.label} to={i.to} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'}`}>
              <Icon size={18} strokeWidth={2.2} />
              {i.label === 'Tasks' && isHead ? 'Tasks (Assign)' : i.label}
              {i.to === '/app/chat' && <span className="ml-auto" />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-3">
          <Link to="/app/settings" onClick={() => setOpen(false)} title="Profile Settings">
            <UserAvatar p={user} size="h-10 w-10 text-sm" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate text-zinc-900 dark:text-white">{user?.full_name}</p>
            <Link to="/app/settings" onClick={() => setOpen(false)} className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white truncate block">
              {isHead ? 'Team Head' : user?.designation} · Settings
            </Link>
          </div>
          <button onClick={() => logout()} title="Sign out" className="p-2 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col z-30">
        {sidebar}
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 28 }}
              className="fixed inset-y-0 left-0 w-[84vw] max-w-[300px] bg-white dark:bg-zinc-900 z-50 lg:hidden shadow-2xl">
              <button onClick={() => setOpen(false)} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={20} /></button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 bg-white/85 dark:bg-zinc-900/85 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 px-4 sm:px-8 h-16">
            <button onClick={() => setOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><Menu size={22} /></button>
            <div className="flex items-center gap-2 lg:hidden">
              <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-cover ring-1 ring-zinc-200 dark:ring-zinc-700" />
              <span className="font-display font-extrabold text-sm">NextGen Octavision</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="font-display font-bold text-lg leading-tight">Welcome, {user?.full_name?.split(' ')[0]}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={toggleMode}
                title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition"
              >
                {mode === 'dark' ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} />}
              </button>

              <span className={`hidden sm:inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full ${isHead ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                {isHead ? '👑 TEAM HEAD' : '👤 EMPLOYEE'}
              </span>
              <div className="relative">
                <button onClick={() => setShowNotif((s) => !s)} className="relative p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                  <Bell size={20} />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>
                  )}
                </button>
                {showNotif && <button aria-label="Close notifications" onClick={() => setShowNotif(false)} className="fixed inset-0 z-40 cursor-default" />}
                <AnimatePresence>
                  {showNotif && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="fixed left-3 right-3 top-[68px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[350px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                        <p className="font-bold text-sm">Notifications & Reminders</p>

                        <div className="flex items-center gap-2">
                          {notifs.some((n) => !n.read) && (
                            <button onClick={markAll} title="Mark all read" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                              <CheckCheck size={13} /> Read
                            </button>
                          )}
                          {notifs.length > 0 && (
                            <button onClick={clearAllNotifs} title="Clear all reminders" className="text-xs font-bold text-zinc-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition flex items-center gap-1">
                              <Trash2 size={13} /> Clear All
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-[380px] overflow-y-auto scroll-thin">
                        {notifs.length === 0 && <p className="text-sm text-zinc-500 text-center py-8">No notifications or reminders 🎉</p>}
                        {notifs.map((n) => (
                          <div key={n.id} className={`group/n w-full flex items-start gap-2 px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition ${!n.read ? 'bg-amber-50/60' : ''}`}>
                            <button onClick={() => openNotif(n)} className="flex-1 text-left min-w-0">
                              <p className="text-sm font-bold flex items-center gap-2">{KIND_ICON[n.kind] || '🔔'} {n.title}</p>
                              <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-[11px] text-zinc-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotif(n.id);
                              }}
                              title="Clear this reminder"
                              className="opacity-0 group-hover/n:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>
        <main className="px-3 pt-4 pb-24 sm:px-8 sm:pt-8 lg:p-8 max-w-[1400px] mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {[
            { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
            { to: '/app/sheet', label: 'Sheet', icon: CalendarCheck2 },
            { to: '/app/chat', label: 'Chat', icon: MessagesSquare },
            { to: '/app/leaves', label: 'Leaves', icon: Plane },
          ].map((i) => {
            const active = i.end ? loc.pathname === '/app' : loc.pathname.startsWith(i.to);
            const Icon = i.icon;
            return (
              <Link key={i.to} to={i.to} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${active ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-zinc-900 dark:bg-white" />}
                <Icon size={20} strokeWidth={2.2} />
                {i.label}
              </Link>
            );
          })}
          <button onClick={() => setOpen(true)} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
            <Menu size={20} strokeWidth={2.2} />
            More
            {unread > 0 && <span className="absolute top-1.5 right-1/2 translate-x-5 h-2 w-2 rounded-full bg-red-500" />}
          </button>
        </div>
      </nav>
    </div>
  );
}


