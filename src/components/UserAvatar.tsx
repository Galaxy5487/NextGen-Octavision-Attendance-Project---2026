import { initials, type Profile } from '../lib/types';

export default function UserAvatar({ p, size = 'h-10 w-10 text-xs' }: { p?: Profile | null; size?: string }) {
  if (p?.avatar_url) {
    return <img src={p.avatar_url} alt={p.full_name} className={`${size} rounded-full object-cover shrink-0 ring-1 ring-zinc-200 bg-zinc-100`} />;
  }
  if (!p) return <img src="/logo.png" alt="NextGen Octavision" className={`${size} rounded-full object-cover shrink-0 ring-1 ring-zinc-200 bg-white`} />;
  return <div className={`${size} rounded-full flex items-center justify-center text-white font-bold shrink-0`} style={{ background: p.avatar_color || '#71717a' }}>{initials(p.full_name)}</div>;
}
