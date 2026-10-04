import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, LogIn, ShieldCheck, User, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, error: authError, setError: setAuthError } = useAuth();
  const [role, setRole] = useState<'employee' | 'head'>('employee');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('octavisionteam@gmail.com');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickRole = (r: 'employee' | 'head') => {
    setRole(r); setErr(null); setAuthError(null);
    setEmail(r === 'employee' ? 'octavisionteam@gmail.com' : '');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'employee' && !fullName.trim()) { setErr('Please enter your Full Name.'); return; }
    setErr(null); setAuthError(null); setBusy(true);
    try { await login(email.trim(), password, role === 'employee' ? fullName : undefined); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };


  return (
    <div className="min-h-dvh bg-zinc-950 text-white flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* Left brand panel */}
      <div className="relative lg:w-[52%] flex flex-col justify-center px-5 sm:px-14 py-8 sm:py-12 login-grid-bg overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-zinc-700/30 blur-3xl" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="relative">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="NextGen Octavision logo" className="h-14 w-14 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-2xl object-cover shadow-2xl ring-1 ring-white/20 bg-white shrink-0" />
            <div>
              <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">NextGen<br />Octavision</h1>
              <p className="mt-2 text-[11px] sm:text-xs tracking-[0.35em] text-zinc-400 font-semibold">CREATE – INNOVATE – EVOLVE</p>
            </div>
          </div>
          <p className="mt-5 sm:mt-8 text-sm sm:text-base text-zinc-300 max-w-md leading-relaxed">
            The agency's official <span className="text-white font-semibold">attendance command center</span> — daily marking, monthly sheets, live scores, warnings, chat & tasks in one place.
          </p>
          <div className="mt-5 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg">
            {[
              { t: 'Smart Calendar', d: 'Sundays auto-leave' },
              { t: 'Live Scores', d: 'Monthly grading' },
              { t: 'Auto Warnings', d: 'Email + chat alerts' },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-white/10 bg-white/5 p-2.5 sm:p-4 backdrop-blur">
                <p className="font-bold text-xs sm:text-sm">{f.t}</p>
                <p className="text-[10px] sm:text-xs text-zinc-400 mt-1">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="hidden lg:flex mt-10 items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck size={14} /> Secure role-based access · Team Head & Employees
          </div>
        </motion.div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 bg-white text-zinc-900 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 dot-bg">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-200 p-5 sm:p-8">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Sign in</h2>
          <p className="text-sm text-zinc-500 mt-1">Access your attendance workspace</p>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1.5">
            <button type="button" onClick={() => pickRole('employee')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${role === 'employee' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-500 hover:text-zinc-900'}`}>
              <User size={15} /> Employee
            </button>
            <button type="button" onClick={() => pickRole('head')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${role === 'head' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-500 hover:text-zinc-900'}`}>
              <ShieldCheck size={15} /> Team Head
            </button>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            {role === 'employee' && (
              <div>
                <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Full Name</label>
                <div className="mt-1.5 relative">
                  <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ayesha Khan"
                    className="w-full rounded-xl border border-zinc-300 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition" />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5">All employees share one email — your Full Name identifies your account.</p>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Email</label>
              <div className="mt-1.5 relative">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@octavision.com"
                  className="w-full rounded-xl border border-zinc-300 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Password</label>
              <div className="mt-1.5 relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full rounded-xl border border-zinc-300 pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {(err || authError) && <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{err || authError}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-zinc-900 text-white font-bold py-3 text-sm hover:bg-zinc-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

        </motion.div>
      </div>
    </div>
  );
}
