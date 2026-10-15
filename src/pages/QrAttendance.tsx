import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QrCode, Scan, Shield, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import QrLeaderView from '../components/QrLeaderView';
import QrMemberScanner from '../components/QrMemberScanner';

export default function QrAttendance() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHead = user?.role === 'head';

  const initialMode = searchParams.get('tab') === 'scan' ? 'scanner' : (isHead ? 'generator' : 'scanner');
  const [mode, setMode] = useState<'generator' | 'scanner'>(initialMode);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'scan') setMode('scanner');
    else if (tab === 'leader') setMode('generator');
  }, [searchParams]);

  const switchMode = (newMode: 'generator' | 'scanner') => {
    setMode(newMode);
    setSearchParams(newMode === 'scanner' ? { tab: 'scan' } : { tab: 'leader' });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Role Switcher Bar (only shown if user is head or testing) */}
      {isHead && (
        <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => switchMode('generator')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                mode === 'generator'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <QrCode size={15} />
              <span>Leader QR Kiosk</span>
            </button>
            <button
              onClick={() => switchMode('scanner')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                mode === 'scanner'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Scan size={15} />
              <span>Member Scanner View</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-zinc-400 hidden sm:flex items-center gap-1.5 px-3">
            <Shield size={13} className="text-emerald-500" />
            <span>Team Leader Mode Enabled</span>
          </div>
        </div>
      )}

      {/* View Content */}
      {mode === 'generator' ? <QrLeaderView /> : <QrMemberScanner />}
    </div>
  );
}
