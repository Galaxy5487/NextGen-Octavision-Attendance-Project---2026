import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Megaphone, Briefcase, Palmtree, Trash2, CheckCircle2, Sparkles, Calendar as CalendarIcon, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { monthStrOf, shiftMonth, monthLabel, pad, type CalendarOverride } from '../lib/types';
import { getEventsForDate, getEventsForMonth } from '../lib/holidays';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const { user } = useAuth();
  const isHead = user?.role === 'head';
  const [month, setMonth] = useState(monthStrOf());
  const [ovs, setOvs] = useState<CalendarOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [kind, setKind] = useState<'sunday_working' | 'leave_day'>('leave_day');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'holiday' | 'festival' | 'celebration'>('all');

  const load = async (m: string) => {
    setLoading(true);
    try {
      setOvs(await api<CalendarOverride[]>(`/api/calendar?month=${m}`));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(month);
  }, [month]);

  const [y, m] = month.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const lead = new Date(y, m - 1, 1).getDay();

  const ovMap: Record<string, CalendarOverride> = {};
  ovs.forEach((o) => {
    ovMap[o.date] = o;
  });

  const today = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;

  const openDayModal = (dateStr: string) => {
    const [yy, mm, dd] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(yy, mm - 1, dd).getDay();
    setKind(dayOfWeek === 0 ? 'sunday_working' : 'leave_day');
    setLabel('');
    setSelectedDay(dateStr);
  };

  const submitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay || !user) return;
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/calendar', {
        method: 'POST',
        body: {
          date: selectedDay,
          kind,
          label: label.trim() || null,
          created_by: user.id,
          announce: true,
        },
      });
      setMsg(
        kind === 'leave_day'
          ? `🏖️ ${selectedDay} announced as office leave — attendance updated for everyone.`
          : `💼 ${selectedDay} announced as working Sunday — attendance will count.`
      );
      setSelectedDay(null);
      await load(month);
    } catch (e: any) {
      setMsg('Failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeOverride = async (o: CalendarOverride) => {
    if (!confirm(`Remove office override for ${o.date}?`)) return;
    await api('/api/calendar', { method: 'DELETE', body: { id: o.id } });
    await load(month);
  };

  // Build grid cells
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(`${month}-${pad(d)}`);

  // Get month celebrations list
  const monthEvents = getEventsForMonth(month);
  const filteredMonthEvents = categoryFilter === 'all'
    ? monthEvents
    : monthEvents.filter((item) => item.event.category === categoryFilter);

  const selectedDayEvents = selectedDay ? getEventsForDate(selectedDay) : [];
  const selectedDayOverride = selectedDay ? ovMap[selectedDay] : null;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 text-zinc-900 dark:text-white">
            <CalendarIcon size={24} className="text-zinc-900 dark:text-zinc-100" /> Agency Calendar & Celebrations
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Auto-synced real calendar events, national holidays, celebrations & agency attendance controls.
          </p>
        </div>
        <div className="sm:ml-auto flex items-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm overflow-hidden w-full sm:w-auto">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-[44px] min-h-[44px] flex items-center justify-center transition"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-4 text-sm font-extrabold flex-1 sm:flex-none sm:min-w-[160px] text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-[44px] min-h-[44px] flex items-center justify-center transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-sm font-semibold px-4 py-3 flex items-center gap-2 shadow-sm">
          <CheckCircle2 size={16} />
          {msg}
        </div>
      )}

      {/* Filter Badges & Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3.5 py-1.5 rounded-full border transition ${
            categoryFilter === 'all'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          ✨ All Events ({monthEvents.length})
        </button>
        <button
          onClick={() => setCategoryFilter('holiday')}
          className={`px-3.5 py-1.5 rounded-full border transition ${
            categoryFilter === 'holiday'
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          🇮🇳 National Holidays
        </button>
        <button
          onClick={() => setCategoryFilter('festival')}
          className={`px-3.5 py-1.5 rounded-full border transition ${
            categoryFilter === 'festival'
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          🪔 Festivals & Celebrations
        </button>
        <span className="ml-auto text-[11px] text-zinc-500 dark:text-zinc-400 font-medium hidden md:inline">
          Click any day to view details {isHead ? 'or announce office leaves' : ''}
        </span>
      </div>

      {/* Main Grid & Monthly Sidebar Layout */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Calendar Grid */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 bg-zinc-950 dark:bg-zinc-950 text-white text-center text-[11px] sm:text-xs font-extrabold tracking-wider">
            {DOW.map((d) => (
              <div key={d} className="py-3 sm:py-3.5">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <div className="animate-spin h-8 w-8 rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-zinc-200/70 dark:bg-zinc-800/70">
              {cells.map((ds, i) => {
                if (!ds)
                  return (
                    <div key={'e' + i} className="bg-zinc-50/40 dark:bg-zinc-900/40 min-h-[72px] sm:min-h-[105px]" />
                  );

                const [yy, mm, dd] = ds.split('-').map(Number);
                const dow = new Date(yy, mm - 1, dd).getDay();
                const ov = ovMap[ds];
                const isLeave = ov?.kind === 'leave_day';
                const isWorkSun = ov?.kind === 'sunday_working';
                const sundayOff = dow === 0 && !isWorkSun;
                const realEvents = getEventsForDate(ds);
                const isToday = ds === today;

                return (
                  <div
                    key={ds}
                    onClick={() => openDayModal(ds)}
                    className={`relative bg-white dark:bg-zinc-900 min-h-[72px] sm:min-h-[105px] p-1.5 sm:p-2.5 transition cursor-pointer hover:bg-zinc-50/90 dark:hover:bg-zinc-800/80 ${
                      isToday ? 'ring-2 ring-inset ring-zinc-900 dark:ring-zinc-100 bg-zinc-50/50 dark:bg-zinc-800/50' : ''
                    } ${
                      isLeave
                        ? 'bg-violet-50/80 dark:bg-violet-950/30'
                        : sundayOff
                        ? 'bg-zinc-50/80 dark:bg-zinc-950/40'
                        : isWorkSun
                        ? 'bg-amber-50/80 dark:bg-amber-950/30'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-extrabold w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                            : dow === 0
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        {dd}
                      </span>

                      {/* Overlap badges */}
                      <div className="flex items-center gap-1">
                        {realEvents.length > 0 && (
                          <span
                            title={realEvents.map((r) => r.title).join(', ')}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 shrink-0"
                          >
                            {realEvents[0].icon}
                          </span>
                        )}
                        {isHead && !ov && (
                          <Plus size={13} className="text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                    </div>

                    {/* Chips inside cell */}
                    <div className="mt-1 space-y-1 overflow-hidden">
                      {/* Real events chip */}
                      {realEvents.slice(0, 2).map((re, idx) => (
                        <p
                          key={idx}
                          className={`text-[9px] sm:text-[10px] font-extrabold truncate px-1.5 py-0.5 rounded-md leading-tight ${
                            re.isNationalHoliday
                              ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200/50 dark:border-red-900/50'
                              : re.category === 'festival'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50'
                          }`}
                        >
                          {re.icon} {re.title}
                        </p>
                      ))}

                      {/* Agency Overrides */}
                      {isLeave && (
                        <p className="text-[9px] sm:text-[10px] font-extrabold text-violet-700 dark:text-violet-300 bg-violet-100/70 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-900 px-1.5 py-0.5 rounded-md truncate leading-tight">
                          🏖️ {ov.label || 'Office leave'}
                        </p>
                      )}
                      {isWorkSun && (
                        <p className="text-[9px] sm:text-[10px] font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 px-1.5 py-0.5 rounded-md truncate leading-tight">
                          💼 {ov.label || 'Working Sunday'}
                        </p>
                      )}
                      {sundayOff && !ov && (
                        <p className="text-[9px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                          ⛱️ Sunday
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly Celebrations Sidebar */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4 text-zinc-900 dark:text-white">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-display font-extrabold text-base flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> Celebrations in {monthLabel(month).split(' ')[0]}
            </h3>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {filteredMonthEvents.length}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto scroll-thin pr-1">
            {filteredMonthEvents.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-8">
                No major celebrations scheduled for this month.
              </p>
            ) : (
              filteredMonthEvents.map(({ dateStr, event }, idx) => {
                const [yy, mm, dd] = dateStr.split('-').map(Number);
                const dayName = new Date(yy, mm - 1, dd).toLocaleDateString('en-US', {
                  weekday: 'short',
                });
                return (
                  <div
                    key={dateStr + idx}
                    onClick={() => openDayModal(dateStr)}
                    className="p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition cursor-pointer flex items-start gap-3"
                  >
                    <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center shrink-0 shadow-xs">
                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase leading-none">
                        {dayName}
                      </span>
                      <span className="text-sm font-extrabold text-zinc-900 dark:text-white leading-tight">
                        {dd}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                        <span>{event.icon}</span> {event.title}
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                        {event.description || event.category}
                      </p>
                      {event.isNationalHoliday && (
                        <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 mt-1">
                          National Holiday
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Day Details & Announcement Modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setSelectedDay(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto scroll-thin text-zinc-900 dark:text-white"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Day Details
                </span>
                <h3 className="font-display font-extrabold text-lg">
                  {new Date(
                    Number(selectedDay.split('-')[0]),
                    Number(selectedDay.split('-')[1]) - 1,
                    Number(selectedDay.split('-')[2])
                  ).toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            {/* Real Celebrations List */}
            {selectedDayEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" /> Real Calendar Events & Celebrations
                </p>
                {selectedDayEvents.map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-1"
                  >
                    <p className="text-sm font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-2">
                      <span className="text-lg">{ev.icon}</span> {ev.title}
                      {ev.isNationalHoliday && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500 text-white">
                          National Holiday
                        </span>
                      )}
                    </p>
                    {ev.description && (
                      <p className="text-xs text-amber-900/80 dark:text-amber-300/80 leading-relaxed">{ev.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Agency Status */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-1.5">
              <p className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Info size={14} /> Agency Status
              </p>
              {selectedDayOverride ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-white">
                    {selectedDayOverride.kind === 'leave_day'
                      ? `🏖️ ${selectedDayOverride.label || 'Office Leave'}`
                      : `💼 ${selectedDayOverride.label || 'Working Sunday'}`}
                  </p>
                  {isHead && (
                    <button
                      onClick={() => removeOverride(selectedDayOverride)}
                      className="text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900 flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                  {new Date(
                    Number(selectedDay.split('-')[0]),
                    Number(selectedDay.split('-')[1]) - 1,
                    Number(selectedDay.split('-')[2])
                  ).getDay() === 0
                    ? '⛱️ Regular Sunday Leave'
                    : '⬜ Regular Agency Working Day'}
                </p>
              )}
            </div>

            {/* Team Head Announcement Form */}
            {isHead && (
              <form
                onSubmit={submitAnnouncement}
                className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3"
              >
                <p className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Megaphone size={14} /> Announce Agency Schedule Change
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKind('leave_day')}
                    className={`rounded-2xl border p-3 text-left transition ${
                      kind === 'leave_day'
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/60 ring-1 ring-violet-400'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Palmtree size={18} className="text-violet-600 dark:text-violet-400" />
                    <p className="text-sm font-bold mt-1 text-zinc-900 dark:text-white">Office Leave</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Day off · auto-marked</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('sunday_working')}
                    className={`rounded-2xl border p-3 text-left transition ${
                      kind === 'sunday_working'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 ring-1 ring-amber-400'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Briefcase size={18} className="text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-bold mt-1 text-zinc-900 dark:text-white">Working Sunday</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Sunday counts</p>
                  </button>
                </div>

                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={
                    kind === 'leave_day'
                      ? 'e.g. Eid Holiday — office closed'
                      : 'e.g. Product launch — full team needed'
                  }
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />

                <button
                  disabled={busy}
                  className="w-full rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold py-3 text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 transition shadow-sm"
                >
                  {busy ? 'Announcing…' : 'Announce & Update Attendance'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
