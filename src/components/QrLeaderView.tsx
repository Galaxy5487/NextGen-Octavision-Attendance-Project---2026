import { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, Maximize2, Minimize2, RefreshCw, Volume2, VolumeX,
  Copy, Check, Download, Printer, ShieldCheck, Users, Clock,
  Sparkles, CheckCircle2, AlertCircle, ArrowUpRight, Flame
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { fmtDate, todayStr, type Profile } from '../lib/types';
import UserAvatar from './UserAvatar';
import { playScanSuccessSound } from '../lib/qr-audio';

interface ScanItem {
  id: number;
  employee_id: number;
  full_name: string;
  designation: string;
  avatar_color: string;
  avatar_url?: string | null;
  status: string;
  note: string | null;
  marked_at: string;
}

interface QrSessionData {
  ok: boolean;
  token: string;
  code: string;
  window: number;
  remainingSec: number;
  intervalSec: number;
  date: string;
  leader_id: number;
  total_employees: number;
  total_marked: number;
  recent_scans: ScanItem[];
}

export default function QrLeaderView() {
  const { user } = useAuth();
  const [session, setSession] = useState<QrSessionData | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [paused, setPaused] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kioskContainerRef = useRef<HTMLDivElement | null>(null);
  const prevScansCountRef = useRef<number>(0);

  // Digital clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch session data
  const fetchSession = useCallback(async (isManual = false) => {
    if (!user) return;
    if (isManual) setRefreshing(true);
    try {
      const data = await api<QrSessionData>(`/api/qr?action=session&leader_id=${user.id}`, { skipCache: true });
      setSession(data);
      setCountdown(data.remainingSec || 30);

      // Play audio chime if new checkin detected
      if (prevScansCountRef.current > 0 && data.total_marked > prevScansCountRef.current && audioEnabled) {
        playScanSuccessSound();
      }
      prevScansCountRef.current = data.total_marked;
    } catch (err) {
      console.error('Failed to fetch QR session:', err);
    } finally {
      if (isManual) setTimeout(() => setRefreshing(false), 400);
    }
  }, [user, audioEnabled]);

  // Initial load & poll live feed every 3.5 seconds
  useEffect(() => {
    fetchSession();
    const interval = setInterval(() => {
      if (!paused && typeof document !== 'undefined' && !document.hidden) {
        fetchSession();
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [fetchSession, paused]);

  // Local second-by-second countdown for the rolling token ring
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchSession();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, fetchSession]);

  // Render QR Code onto Canvas whenever session token changes
  useEffect(() => {
    if (!session?.token || !canvasRef.current) return;
    const canvas = canvasRef.current;

    QRCode.toCanvas(
      canvas,
      session.token,
      {
        width: 320,
        margin: 2,
        color: {
          dark: '#09090b',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      },
      (err) => {
        if (err) console.error('QR Render Error:', err);
      }
    );
  }, [session?.token]);

  // Toggle Fullscreen Kiosk
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      kioskContainerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Force token refresh
  const handleForceRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const res = await api<QrSessionData>('/api/qr', {
        method: 'POST',
        body: { action: 'refresh', leader_id: user.id },
      });
      setSession(res);
      setCountdown(res.remainingSec || 30);
    } catch (e: any) {
      alert('Refresh failed: ' + e.message);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  // Copy 6-digit fallback code
  const copyCode = () => {
    if (!session?.code) return;
    navigator.clipboard.writeText(session.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy Direct Scanner Link for Members
  const copyScannerLink = () => {
    const url = `${window.location.origin}/#/app/qr?tab=scan`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Download high-res QR code image
  const downloadQrCode = () => {
    if (!session?.token) return;
    QRCode.toDataURL(session.token, {
      width: 800,
      margin: 3,
      color: { dark: '#09090b', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).then((dataUrl) => {
      const link = document.createElement('a');
      link.download = `NextGen-Octavision-Attendance-QR-${todayStr()}.png`;
      link.href = dataUrl;
      link.click();
    });
  };

  // Print Kiosk Sheet
  const printSheet = () => {
    window.print();
  };

  const totalEmps = session?.total_employees || 0;
  const markedEmps = session?.total_marked || 0;
  const checkinPercentage = totalEmps > 0 ? Math.round((markedEmps / totalEmps) * 100) : 0;
  const intervalSec = session?.intervalSec || 30;
  const progressRatio = Math.max(0, Math.min(1, countdown / intervalSec));

  return (
    <div
      ref={kioskContainerRef}
      className={`relative transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-zinc-950 text-white p-6 sm:p-10 flex flex-col justify-between overflow-y-auto'
          : 'space-y-6 text-zinc-900 dark:text-white'
      }`}
    >
      {/* Top Header / Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Live Attendance Kiosk Active
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 flex items-center gap-2">
            <QrCode className="text-emerald-600 dark:text-emerald-400" size={28} />
            Contactless QR Generator
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Display this screen at the entrance/desk. Members scan using their phone camera to instantly check in.
          </p>
        </div>

        {/* Kiosk Controls & Digital Clock */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Digital Clock */}
          <div className="bg-zinc-100 dark:bg-zinc-800/80 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 font-mono text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm">
            <Clock size={15} className="text-emerald-500" />
            <span>{currentTime.toLocaleTimeString('en-US', { hour12: true })}</span>
            <span className="text-zinc-400 dark:text-zinc-500 font-sans text-xs font-semibold hidden md:inline">
              · {fmtDate(todayStr())}
            </span>
          </div>

          {/* Sound Chime Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? 'Audio Chime Enabled' : 'Audio Chime Muted'}
            className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold ${
              audioEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{audioEnabled ? 'Chime On' : 'Muted'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Open Fullscreen Kiosk Mode'}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 transition flex items-center gap-1.5 text-xs font-bold shadow-sm"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Kiosk' : 'Fullscreen Kiosk'}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={handleForceRefresh}
            disabled={refreshing}
            title="Generate Fresh Security Token Now"
            className="p-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Grid: QR Display (Left) + Live Check-in Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: QR Card (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white via-zinc-50 to-zinc-100 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl p-6 sm:p-8 flex flex-col items-center text-center">
            {/* Background Glow */}
            <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-4 shadow-sm">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Anti-Proxy Dynamic Rolling Token</span>
            </div>

            {/* Canvas QR Code with Branding Wrapper */}
            <div className="relative group p-4 sm:p-5 rounded-3xl bg-white shadow-2xl ring-1 ring-zinc-900/10 dark:ring-white/20 transition-transform duration-300 hover:scale-[1.01]">
              <canvas ref={canvasRef} className="block rounded-2xl mx-auto w-64 h-64 sm:w-72 sm:h-72" />
              
              {/* Center Logo Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-12 w-12 rounded-xl bg-white p-1 shadow-lg ring-2 ring-zinc-900/10 flex items-center justify-center">
                  <img src="/logo.png" alt="Logo" className="h-full w-full object-cover rounded-lg" />
                </div>
              </div>
            </div>

            {/* Rolling Countdown Progress Bar */}
            <div className="w-full max-w-xs mt-6 space-y-1.5">
              <div className="flex justify-between items-center text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={11} className={paused ? '' : 'animate-spin'} style={{ animationDuration: '4s' }} />
                  {paused ? 'Auto-refresh paused' : `Token refreshes in ${countdown}s`}
                </span>
                <span>{Math.round(progressRatio * 100)}%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  style={{ width: `${progressRatio * 100}%` }}
                  transition={{ ease: 'linear', duration: 0.3 }}
                />
              </div>
            </div>

            {/* Fallback 6-digit Code Entry */}
            <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800 w-full flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl p-4">
              <div className="text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Manual 6-Digit Check-in Code
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-zinc-900 dark:text-white">
                    {session?.code || 'OCT-••••'}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 transition"
                    title="Copy code"
                  >
                    {copiedCode ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaused(!paused)}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition shadow-sm"
                >
                  {paused ? 'Resume Rolling' : 'Pause Rolling'}
                </button>
                <button
                  onClick={downloadQrCode}
                  className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition shadow-sm"
                  title="Download High-Res QR Code PNG"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={printSheet}
                  className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition shadow-sm"
                  title="Print Kiosk Attendance Sheet"
                >
                  <Printer size={16} />
                </button>
              </div>
            </div>

            {/* Quick Share Link for Members */}
            <div className="mt-3 flex items-center justify-between w-full px-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>Members without camera can enter code manually.</span>
              <button
                onClick={copyScannerLink}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
              >
                {copiedLink ? 'Link Copied!' : 'Copy Scanner Link'}
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Attendees & Today's Attendance Progress (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Progress Card */}
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-extrabold tracking-wider text-zinc-400 dark:text-zinc-500">
                  Today's Attendance
                </p>
                <h3 className="font-display text-xl font-black text-zinc-900 dark:text-white mt-0.5">
                  {markedEmps} of {totalEmps} Checked In
                </h3>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400 text-base">
                {checkinPercentage}%
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${checkinPercentage}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-2.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase">Checked In</span>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{markedEmps}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-2.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase">Awaiting</span>
                <p className="text-lg font-black text-zinc-500 dark:text-zinc-400">{Math.max(0, totalEmps - markedEmps)}</p>
              </div>
            </div>
          </div>

          {/* Live Check-in Stream */}
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm flex flex-col max-h-[480px]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Users size={17} className="text-emerald-500" />
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Live Check-in Feed</h4>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Real-time
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80 pr-1 mt-2 space-y-1">
              {session?.recent_scans && session.recent_scans.length > 0 ? (
                <AnimatePresence initial={false}>
                  {session.recent_scans.map((scan) => (
                    <motion.div
                      key={`${scan.employee_id}-${scan.marked_at}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm"
                          style={{ backgroundColor: scan.avatar_color || '#3f3f46' }}
                        >
                          {scan.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {scan.full_name}
                          </p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {scan.designation || 'Team Member'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          {scan.status}
                        </span>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                          {new Date(scan.marked_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                  <Clock size={32} className="mx-auto mb-2 opacity-40 stroke-1" />
                  <p className="text-xs font-semibold">No check-ins recorded yet today.</p>
                  <p className="text-[11px] mt-0.5 text-zinc-400">Scanned members will appear here live with an audio chime.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
