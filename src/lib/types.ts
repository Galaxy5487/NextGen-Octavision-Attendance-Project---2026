export interface Profile {
  id: number;
  full_name: string;
  email: string;
  designation: string;
  phone: string;
  role: 'head' | 'employee';
  avatar_color: string;
  avatar_url?: string | null;
  active: boolean;
  created_at: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'half' | 'permitted' | 'leave' | 'sunday';

export interface AttendanceRow {
  id: number;
  employee_id: number;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  marked_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarOverride {
  id: number;
  date: string;
  kind: 'sunday_working' | 'leave_day';
  label: string | null;
  created_by: number | null;
  announced: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  kind: string;
  created_by: number | null;
  audience: string;
  created_at: string;
}

export interface Thread {
  id: number;
  type: 'dm' | 'group' | 'system';
  name: string;
  member_ids: number[];
  created_by: number | null;
  created_at: string;
  last_message?: { body: string; created_at: string } | null;
}

export interface Message {
  id: number;
  thread_id: number;
  sender_id: number | null;
  body: string;
  kind: string;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  assignee_id: number;
  assigned_by: number | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'done';
  created_at: string;
}

export interface LeaveRequest {
  id: number;
  employee_id: number;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'pending' | 'permitted' | 'denied';
  decided_by: number | null;
  decided_at: string | null;
  created_at: string;
}

export interface WarningLog {
  id: number;
  employee_id: number;
  date: string;
  subject: string;
  body: string;
  score_snapshot: number;
  email_status: string;
  created_at: string;
}

export interface Notif {
  id: number;
  user_id: number;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface DayInfo {
  date: string;
  dow: number;
  isSunday: boolean;
  override: string | null;
  label: string | null;
  counts: boolean;
  future: boolean;
}

export interface EmpStat {
  employee_id: number;
  present: number;
  absent: number;
  half: number;
  permitted: number;
  unmarked: number;
  earned: number;
  workingDays: number;
  score: number | null;
  grade: string;
  low: boolean;
  warnings: number;
}

export interface MonthStats {
  year: number;
  month: number;
  days: DayInfo[];
  workingDays: number;
  stats: EmpStat[];
  employees: Profile[];
  low_threshold: number;
}

export const STATUS_META: Record<string, { label: string; short: string; cell: string; dot: string; text: string }> = {
  present: { label: 'Present', short: 'P', cell: 'bg-emerald-500 text-white', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  absent: { label: 'Absent', short: 'A', cell: 'bg-red-500 text-white', dot: 'bg-red-500', text: 'text-red-700' },
  half: { label: 'Half Day', short: 'H', cell: 'bg-amber-400 text-amber-950', dot: 'bg-amber-400', text: 'text-amber-700' },
  permitted: { label: 'Permitted', short: 'PL', cell: 'bg-sky-500 text-white', dot: 'bg-sky-500', text: 'text-sky-700' },
  leave: { label: 'Leave', short: 'L', cell: 'bg-violet-500 text-white', dot: 'bg-violet-500', text: 'text-violet-700' },
  sunday: { label: 'Sunday', short: 'S', cell: 'bg-zinc-200 text-zinc-500', dot: 'bg-zinc-300', text: 'text-zinc-500' },
};

export function initials(name: string) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export function pad(n: number) { return String(n).padStart(2, '0'); }

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthStrOf(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(m: string) {
  const [y, mm] = m.split('-').map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function shiftMonth(m: string, delta: number) {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function fmtDate(ds: string) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtTime(ts: string) {
  try { return new Date(ts).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  catch { return ts; }
}

export function gradeColor(g: string) {
  if (g === 'A+' || g === 'A') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (g === 'B') return 'bg-lime-100 text-lime-800 border-lime-200';
  if (g === 'C') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (g === 'D') return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}
