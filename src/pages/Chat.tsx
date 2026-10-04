import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Users, User, Plus, AlertTriangle, X, Trash2, Pencil, Search, MessageSquarePlus, Crown, Eraser, MoreVertical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { Thread, Message, Profile } from '../lib/types';
import UserAvatar from '../components/UserAvatar';

function Avatar({ p, size = 'h-10 w-10 text-xs' }: { p?: Profile; size?: string }) {
  return <UserAvatar p={p} size={size} />;
}

export default function Chat() {
  const { user } = useAuth();
  const isHead = user?.role === 'head';
  const [threads, setThreads] = useState<Thread[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [gName, setGName] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [mobileList, setMobileList] = useState(true);
  const [searchContact, setSearchContact] = useState('');
  const [searchThread, setSearchThread] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);


  const loadThreads = async () => {
    try {
      const p = await api<Profile[]>('/api/employees').catch(() => []);
      const activePeople = (p || []).filter((x) => x.active !== false);
      setPeople(activePeople);

      if (user?.id) {
        const t = await api<Thread[]>(`/api/threads?user_id=${user.id}`).catch(() => []);
        setThreads(t || []);

        setActive((current) => {
          if (current === null && (t || []).length > 0) return t[0].id;
          return current;
        });
      }
    } catch (e) {
      console.error('Failed loading chat data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const loadMsgs = async (tid: number) => {
    try {
      setMsgs(await api<Message[]>(`/api/messages?thread_id=${tid}`));
    } catch {}
  };

  useEffect(() => {
    setShowMenu(false);
    if (!active) return;
    loadMsgs(active);
    const timer = setInterval(() => loadMsgs(active), 3500);
    return () => clearInterval(timer);
  }, [active]);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!active || !text.trim() || !user) return;
    const body = text.trim();
    setText('');
    try {
      await api('/api/messages', {
        method: 'POST',
        body: { thread_id: active, sender_id: user.id, body },
      });
      await loadMsgs(active);
      loadThreads();
    } catch (err) {
      console.error(err);
    }
  };

  const openNewModal = (initialMode: 'dm' | 'group' = 'dm') => {
    setMode(initialMode);
    setPicked([]);
    setGName('');
    setSearchContact('');
    setShowNew(true);
  };

  const createThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !picked.length) return;
    setBusy(true);
    try {
      if (mode === 'dm') {
        const other = people.find((p) => p.id === picked[0])!;
        const t = await api<Thread>('/api/threads', {
          method: 'POST',
          body: {
            type: 'dm',
            name: `${user.full_name} × ${other.full_name}`,
            member_ids: [user.id, other.id],
            created_by: user.id,
          },
        });
        setActive(t.id);
      } else {
        if (!gName.trim()) {
          setBusy(false);
          return;
        }
        const t = await api<Thread>('/api/threads', {
          method: 'POST',
          body: {
            type: 'group',
            name: gName.trim(),
            member_ids: [...new Set([user.id, ...picked])],
            created_by: user.id,
          },
        });
        setActive(t.id);
      }
      setShowNew(false);
      setPicked([]);
      setGName('');
      await loadThreads();
      setMobileList(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create thread');
    } finally {
      setBusy(false);
    }
  };

  const deleteThread = async (id: number) => {
    if (!confirm('Delete this conversation and all its messages?')) return;
    await api('/api/threads', { method: 'DELETE', body: { id } });
    if (active === id) {
      setActive(null);
      setMsgs([]);
    }
    loadThreads();
  };

  const byId = (id: number | null) => people.find((p) => p.id === id);

  const threadLabel = (t: Thread) => {
    if (t.type !== 'dm') return t.name;
    const other = t.member_ids.map(byId).find((p) => p && String(p.id) !== String(user?.id));
    return other ? other.full_name : t.name;
  };

  const threadIcon = (t: Thread) => {
    if (t.type === 'system')
      return (
        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0 shadow-sm">
          <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
        </div>
      );
    if (t.type === 'group')
      return (
        <div className="h-10 w-10 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0 shadow-sm">
          <Users size={18} className="text-white dark:text-zinc-900" />
        </div>
      );
    const other = t.member_ids.map(byId).find((p) => p && String(p.id) !== String(user?.id));
    return <Avatar p={other} />;
  };

  const deleteMessage = async (mid: number) => {
    if (!confirm('Delete this message?')) return;
    try {
      await api('/api/messages', { method: 'DELETE', body: { id: mid } });
      if (active) loadMsgs(active);
    } catch (e: any) {
      alert('Failed to delete message: ' + e.message);
    }
  };

  const clearChat = async () => {
    if (!active) return;
    if (!confirm('Clear all messages in this conversation?')) return;
    try {
      await api('/api/messages', { method: 'DELETE', body: { thread_id: active } });
      loadMsgs(active);
      loadThreads();
    } catch (e: any) {
      alert('Failed to clear chat: ' + e.message);
    }
  };

  const activeThread = threads.find((t) => t.id === active);

  const others = people.filter((p) => String(p.id) !== String(user?.id));

  const sortedOthers = [...others].sort((a, b) => {
    if (a.role === 'head' && b.role !== 'head') return -1;
    if (a.role !== 'head' && b.role === 'head') return 1;
    return a.full_name.localeCompare(b.full_name);
  });

  const filteredContacts = sortedOthers.filter(
    (p) =>
      p.full_name.toLowerCase().includes(searchContact.toLowerCase()) ||
      (p.designation || '').toLowerCase().includes(searchContact.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchContact.toLowerCase())
  );

  const filteredThreads = threads.filter((t) =>
    threadLabel(t).toLowerCase().includes(searchThread.toLowerCase())
  );

  const selectedPerson = mode === 'dm' && picked.length ? people.find((p) => p.id === picked[0]) : null;

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">Team Chat</h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {isHead
              ? 'Chat with employees, create groups, warnings land here too.'
              : 'Chat with Team Head and team members. Absence warnings appear here.'}
          </p>
        </div>
        <button
          onClick={() => openNewModal('dm')}
          className="ml-auto flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold px-3 sm:px-4 py-2.5 hover:bg-zinc-700 dark:hover:bg-zinc-200 shrink-0 min-h-[44px] shadow-sm transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Chat / Group</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100dvh-280px)] min-h-[420px] lg:h-[calc(100vh-220px)] lg:min-h-[480px]">
        {/* Thread list */}
        <div
          className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex-col ${
            mobileList ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Conversations ({threads.length})
            </span>
            <button
              onClick={() => openNewModal('dm')}
              title="Start New Chat"
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <MessageSquarePlus size={16} />
            </button>
          </div>

          {threads.length > 0 && (
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-zinc-400" />
                <input
                  value={searchThread}
                  onChange={(e) => setSearchThread(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scroll-thin">
            {threads.length === 0 && (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                  <Users size={22} />
                </div>
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">No conversations yet</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[200px] mx-auto">
                  Start a direct chat or group with your Team Head and employees.
                </p>
                <button
                  onClick={() => openNewModal('dm')}
                  className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800"
                >
                  Start First Chat
                </button>
              </div>
            )}
            {filteredThreads.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setActive(t.id);
                  setMobileList(false);
                }}
                className={`group/item w-full flex items-center gap-3 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800 text-left transition cursor-pointer select-none ${
                  active === t.id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-white'
                }`}
              >
                {threadIcon(t)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{threadLabel(t)}</p>
                  <p
                    className={`text-xs truncate ${
                      active === t.id ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {t.last_message?.body || 'No messages yet'}
                  </p>
                </div>
                {t.type === 'system' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white shrink-0">
                    ALERTS
                  </span>
                )}
                {t.type === 'group' && (
                  <Users
                    size={14}
                    className={`shrink-0 ${active === t.id ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'}`}
                  />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteThread(t.id);
                  }}
                  title="Remove / Delete conversation contact"
                  className={`p-1.5 rounded-lg transition shrink-0 ${
                    active === t.id
                      ? 'text-zinc-400 dark:text-zinc-500 hover:text-red-400 hover:bg-white/10'
                      : 'text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div
          className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex-col ${
            mobileList ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
              <img
                src="/logo.png"
                alt=""
                className="h-16 w-16 rounded-2xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-700 opacity-80"
              />
              <p className="font-bold text-base text-zinc-900 dark:text-white">Select a conversation</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
                Pick a chat from the sidebar or click below to start chatting with Team Head or employees.
              </p>
              <button
                onClick={() => openNewModal('dm')}
                className="mt-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold px-4 py-2.5 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
              >
                New Chat / Group
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40">
                <button
                  onClick={() => setMobileList(true)}
                  className="lg:hidden text-sm font-bold text-zinc-600 dark:text-zinc-400"
                >
                  ← Back
                </button>
                {threadIcon(activeThread)}
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate flex items-center gap-2 text-zinc-900 dark:text-white">
                    {threadLabel(activeThread)}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {activeThread.type === 'group'
                      ? `${activeThread.member_ids.length} members`
                      : activeThread.type === 'system'
                      ? 'Automatic attendance alerts'
                      : 'Direct message'}
                  </p>
                </div>
                {/* 3-dots Menu Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowMenu((s) => !s)}
                    title="Chat Options"
                    className="p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 transition flex items-center justify-center"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {showMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                        {msgs.length > 0 && (
                          <button
                            onClick={() => {
                              setShowMenu(false);
                              clearChat();
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                          >
                            <Eraser size={15} className="text-zinc-500 dark:text-zinc-400" />
                            Clear Chat
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            deleteThread(activeThread.id);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition text-left"
                        >
                          <Trash2 size={15} className="text-red-500" />
                          Remove Contact
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scroll-thin p-4 sm:p-5 space-y-3 bg-[#fafafa] dark:bg-[#09090b]">
                {msgs.map((m) => {
                  const mine = String(m.sender_id) === String(user?.id);
                  const sender = byId(m.sender_id);
                  if (m.kind === 'warning') {
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 relative group"
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-xs font-extrabold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <AlertTriangle size={14} /> ATTENDANCE WARNING
                          </p>
                          {(mine || isHead) && (
                            <button
                              onClick={() => deleteMessage(m.id)}
                              title="Delete warning"
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-700 dark:hover:text-red-300 transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-red-900 dark:text-red-200 mt-1.5 leading-relaxed">{m.body}</p>
                        <p className="text-[11px] text-red-400 dark:text-red-300 mt-1.5">
                          {new Date(m.created_at).toLocaleString()}
                        </p>
                      </motion.div>
                    );
                  }
                  return (
                    <div
                      key={m.id}
                      className={`group flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!mine && <Avatar p={sender} size="h-8 w-8 text-[10px]" />}
                      <div
                        className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 sm:px-4 py-2.5 ${
                          mine
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-md shadow-sm'
                            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-bl-md shadow-sm'
                        }`}
                      >
                        {!mine && (
                          <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 flex items-center gap-1">
                            {sender?.full_name || 'Unknown'}
                            {sender?.role === 'head' && (
                              <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                👑 HEAD
                              </span>
                            )}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            mine ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {new Date(m.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {(mine || isHead) && (
                        <button
                          onClick={() => deleteMessage(m.id)}
                          title="Delete message"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="p-3 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 bg-white dark:bg-zinc-900">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Message ${activeThread.type === 'group' ? 'group' : ''}…`}
                  className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
                <button className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition font-bold">
                  <Send size={17} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* New Chat / Group Modal */}
      {showNew && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowNew(false)}
        >
          <form
            onSubmit={createThread}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col text-zinc-900 dark:text-white"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="font-display font-extrabold text-lg">New Chat / Group</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Pick Team Head or Employees to start chatting</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mode selection tabs */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode('dm');
                  setPicked([]);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  mode === 'dm'
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <User size={18} />
                <p className="text-sm font-bold mt-1">Direct Chat</p>
                <p
                  className={`text-[10px] mt-0.5 ${
                    mode === 'dm' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  1-on-1 private chat
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('group');
                  setPicked([]);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  mode === 'group'
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Users size={18} />
                <p className="text-sm font-bold mt-1">Group Chat</p>
                <p
                  className={`text-[10px] mt-0.5 ${
                    mode === 'group' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Multi-person team chat
                </p>
              </button>
            </div>

            {/* Group Name input */}
            {mode === 'group' && (
              <div className="mt-3">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block mb-1">Group Name *</label>
                <input
                  required
                  value={gName}
                  onChange={(e) => setGName(e.target.value)}
                  placeholder="e.g. Design Team, Octavision Core"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            )}

            {/* Contact search & label */}
            <div className="mt-4 flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {mode === 'dm' ? 'Pick a Contact' : 'Pick Members'} ({filteredContacts.length})
              </p>
            </div>

            <div className="relative mb-2">
              <Search size={14} className="absolute left-3.5 top-3 text-zinc-400" />
              <input
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                placeholder="Search Team Head or Employees by name..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto scroll-thin space-y-1.5 max-h-[250px] min-h-[160px] pr-1">
              {filteredContacts.length === 0 && (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  <p className="text-xs font-semibold">No contacts found</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {searchContact ? 'Try a different search term.' : 'No other team members registered yet.'}
                  </p>
                </div>
              )}
              {filteredContacts.map((p) => {
                const on = picked.includes(p.id);
                const isTeamHead = p.role === 'head';
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      setPicked(
                        mode === 'dm'
                          ? [p.id]
                          : on
                          ? picked.filter((x) => x !== p.id)
                          : [...picked, p.id]
                      )
                    }
                    className={`w-full flex items-center gap-3 rounded-xl border p-2.5 transition text-left ${
                      on
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800 ring-1 ring-zinc-900 dark:ring-zinc-100'
                        : isTeamHead
                        ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/80 dark:hover:bg-amber-950/40'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <Avatar p={p} size="h-9 w-9 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate flex items-center gap-1.5 text-zinc-900 dark:text-white">
                        {p.full_name}
                        {isTeamHead && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 flex items-center gap-0.5">
                            <Crown size={10} /> TEAM HEAD
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {isTeamHead ? 'Agency Leader · Team Head' : p.designation || 'Team Member'}
                      </p>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                        on
                          ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900'
                          : 'border-zinc-300 dark:border-zinc-700 text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Action button */}
            <button
              disabled={
                busy ||
                !picked.length ||
                (mode === 'group' && !gName.trim())
              }
              className="mt-4 w-full rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold py-3 text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Pencil size={15} />{' '}
              {busy
                ? 'Creating…'
                : mode === 'dm'
                ? selectedPerson
                  ? `Start Chat with ${selectedPerson.full_name.split(' ')[0]}`
                  : 'Start Direct Chat'
                : `Create Group (${picked.length} selected)`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
