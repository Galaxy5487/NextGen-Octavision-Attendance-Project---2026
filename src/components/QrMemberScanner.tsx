import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan, Camera, Flashlight, RefreshCw, KeyRound, Image as ImageIcon,
  CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Sparkles, Clock, CalendarCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { fmtDate, todayStr, type Profile } from '../lib/types';
import { playScanSuccessSound, playScanErrorSound, triggerHapticFeedback } from '../lib/qr-audio';

interface ScanSuccessResult {
  already_marked: boolean;
  status: string;
  time: string;
  date: string;
  message: string;
  employee: Profile;
}

export default function QrMemberScanner() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'upload'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<ScanSuccessResult | null>(null);
  const [todayStatus, setTodayStatus] = useState<{ marked: boolean; status: string | null; time?: string } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-camera-viewport';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check today's status on mount
  const checkTodayStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api<{ ok: boolean; marked: boolean; status: string | null; row: any }>(
        `/api/qr?action=employee_status&employee_id=${user.id}`,
        { skipCache: true }
      );
      if (res && res.marked) {
        const timePart = res.row?.note?.includes('at ') ? res.row.note.split('at ')[1] : '';
        setTodayStatus({ marked: true, status: res.status, time: timePart });
      } else {
        setTodayStatus({ marked: false, status: null });
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    checkTodayStatus();
  }, [checkTodayStatus]);

  // Clean stop scanner helper
  const stopCamera = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (err) {
      console.debug('Error stopping camera:', err);
    } finally {
      setIsScanning(false);
      setIsTorchOn(false);
    }
  };

  // Submit scan payload to server
  const submitMark = async (token?: string, code?: string) => {
    if (!user) return;
    setProcessing(true);
    setCameraError(null);

    try {
      const data = await api<ScanSuccessResult>('/api/qr', {
        method: 'POST',
        body: {
          action: 'mark',
          token,
          code,
          employee_id: user.id,
          status: 'present',
        },
      });

      // Feedback: Melodic chime + device vibration
      playScanSuccessSound();
      triggerHapticFeedback([120, 60, 120]);

      setResult(data);
      checkTodayStatus();
      await stopCamera();
    } catch (err: any) {
      playScanErrorSound();
      triggerHapticFeedback([200]);
      setCameraError(err.message || 'Verification failed. Please scan again.');
      // Auto-clear error after 4 seconds
      setTimeout(() => setCameraError(null), 4000);
    } finally {
      setProcessing(false);
    }
  };

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    if (activeTab !== 'camera' || result) return;
    setCameraError(null);

    try {
      // Ensure any existing instance is stopped
      await stopCamera();

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      const qrScanner = html5QrCodeRef.current;

      await qrScanner.start(
        { facingMode },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.72);
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          if (processing) return;
          console.log('Decoded QR payload:', decodedText);
          await submitMark(decodedText, undefined);
        },
        () => {
          // ignore frame scan misses
        }
      );

      setIsScanning(true);

      // Check torch capability
      try {
        const capabilities: any = qrScanner.getRunningTrackCapabilities();
        setHasTorch(Boolean(capabilities && capabilities.torch));
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setIsScanning(false);
      const isPermDenied = err?.name === 'NotAllowedError' || String(err).includes('Permission');
      setCameraError(
        isPermDenied
          ? 'Camera permission was denied. Please allow camera access in your browser, or use the 6-Digit Code tab below.'
          : 'Could not access device camera. You can check in using the 6-Digit Code tab or upload an image.'
      );
    }
  }, [activeTab, facingMode, processing, result]);

  // Start camera when on camera tab and no result
  useEffect(() => {
    if (activeTab === 'camera' && !result) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, facingMode, result]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Flip Camera Front/Back
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Manual 6-digit Code Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    submitMark(undefined, manualCode.trim());
  };

  // Scan from Image file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    setCameraError(null);

    try {
      const fileScanner = new Html5Qrcode('file-scanner-temp', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const decodedText = await fileScanner.scanFile(file, true);
      fileScanner.clear();
      await submitMark(decodedText, undefined);
    } catch (err: any) {
      playScanErrorSound();
      setCameraError('No valid QR code was detected in the selected image. Please try another photo or enter the code.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto text-zinc-900 dark:text-white">
      {/* Hidden container for image decoding */}
      <div id="file-scanner-temp" className="hidden" />

      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-1 shadow-sm">
          <Sparkles size={14} className="text-emerald-500" />
          <span>Contactless Attendance Check-in</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
          Scan Attendance QR
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Hold your camera up to the team leader's live screen. Attendance is marked instantly without touching anything.
        </p>
      </div>

      {/* Today's Existing Status Banner (if marked) */}
      {todayStatus?.marked && !result && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0 shadow">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                You are Checked In Today!
              </p>
              <p className="text-xs text-emerald-900/80 dark:text-emerald-200 mt-0.5">
                Marked as <span className="font-bold uppercase">{todayStatus.status}</span>
                {todayStatus.time ? ` at ${todayStatus.time}` : ''} on {fmtDate(todayStr())}.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-200/60 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-100 shrink-0">
            All Set
          </span>
        </motion.div>
      )}

      {/* Celebratory Success Modal Card (When scan succeeds) */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-3xl bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border border-emerald-300 dark:border-emerald-800/80 p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden"
          >
            {/* Ambient glow */}
            <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-52 h-52 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-xl shadow-emerald-500/30 ring-8 ring-emerald-100 dark:ring-emerald-950/60 mb-5">
                <CheckCircle2 size={44} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-2">
                <ShieldCheck size={14} />
                <span>Verified Attendance</span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                {result.already_marked ? 'Already Checked In!' : 'Attendance Marked!'}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 max-w-sm mx-auto">
                {result.already_marked
                  ? `You were already recorded as present today.`
                  : `Your contactless attendance was recorded successfully.`}
              </p>

              {/* Details card */}
              <div className="mt-6 rounded-2xl bg-white dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/80 p-4 max-w-sm mx-auto text-left space-y-2.5 shadow-sm">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Employee:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{result.employee.full_name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Date:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{fmtDate(result.date)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Check-in Time:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{result.time}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Status:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold uppercase text-[10px]">
                    {result.status}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
                <a
                  href="#/app/sheet"
                  className="flex-1 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold py-3 text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition shadow flex items-center justify-center gap-1.5"
                >
                  <CalendarCheck size={16} />
                  View Attendance Sheet
                </a>
                <button
                  onClick={() => {
                    setResult(null);
                    startCamera();
                  }}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 font-bold py-3 px-4 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Scan Again
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Scanner Card (shown when no result) */}
      {!result && (
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'camera'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-900'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Camera size={16} />
              <span>Camera Scan</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'manual'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-900'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <KeyRound size={16} />
              <span>6-Digit Code</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'upload'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-900'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <ImageIcon size={16} />
              <span>Upload Image</span>
            </button>
          </div>

          <div className="p-5 sm:p-7">
            {/* Error Banner */}
            {cameraError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 p-3.5 text-xs font-semibold flex items-center gap-2.5"
              >
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <span>{cameraError}</span>
              </motion.div>
            )}

            {/* TAB 1: LIVE CAMERA VIEWPORT */}
            {activeTab === 'camera' && (
              <div className="space-y-4">
                <div className="relative mx-auto max-w-[340px] sm:max-w-[380px] aspect-square rounded-3xl overflow-hidden bg-black shadow-inner ring-1 ring-zinc-800">
                  {/* Camera Video Stream Element */}
                  <div id={scannerContainerId} className="w-full h-full object-cover" />

                  {/* High-tech Scanner Viewfinder Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                    <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border-2 border-emerald-500/40 animate-scan-target">
                      {/* 4 Corner Targeting Brackets */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                      {/* Moving Laser Beam */}
                      <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,1)] animate-laser-scan" />
                    </div>
                  </div>

                  {/* Processing Overlay */}
                  {processing && (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3 z-20">
                      <div className="animate-spin h-10 w-10 rounded-full border-4 border-emerald-500/30 border-t-emerald-400" />
                      <p className="text-xs font-bold tracking-wide">Verifying Attendance…</p>
                    </div>
                  )}

                  {/* Camera Active Pill */}
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 border border-white/10 z-10">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}</span>
                  </div>
                </div>

                {/* Camera Control Toolbar */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={toggleFacingMode}
                    className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw size={14} />
                    <span>Switch Camera</span>
                  </button>

                  {hasTorch && (
                    <button
                      onClick={toggleTorch}
                      className={`px-3.5 py-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold shadow-sm ${
                        isTorchOn
                          ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      <Flashlight size={14} className={isTorchOn ? 'fill-current' : ''} />
                      <span>{isTorchOn ? 'Torch On' : 'Torch'}</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-center text-zinc-400 dark:text-zinc-500">
                  Align the team leader's QR code within the frame. It will scan and mark automatically.
                </p>
              </div>
            )}

            {/* TAB 2: MANUAL 6-DIGIT CODE */}
            {activeTab === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-4 max-w-md mx-auto py-2">
                <div className="text-center space-y-1">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mx-auto flex items-center justify-center text-zinc-700 dark:text-zinc-300 mb-2">
                    <KeyRound size={24} />
                  </div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                    Enter Kiosk Code
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Enter the rolling 6-digit code currently shown on the leader's screen (e.g. OCT-8941).
                  </p>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="OCT-••••"
                    maxLength={10}
                    className="w-full text-center font-mono text-2xl font-black tracking-widest uppercase rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3.5 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-white"
                  />
                  <p className="text-[11px] text-zinc-400 text-center">
                    Case-insensitive · Valid for current 30s session window
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={processing || !manualCode.trim()}
                  className="w-full rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold py-3.5 text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow"
                >
                  {processing ? (
                    <span className="animate-spin h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  <span>{processing ? 'Verifying Code…' : 'Submit & Mark Present'}</span>
                </button>
              </form>
            )}

            {/* TAB 3: UPLOAD IMAGE SCAN */}
            {activeTab === 'upload' && (
              <div className="space-y-4 max-w-md mx-auto py-2 text-center">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mx-auto flex items-center justify-center text-zinc-700 dark:text-zinc-300 mb-2">
                  <ImageIcon size={24} />
                </div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  Upload QR Code Image
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select a screenshot or photo of the attendance QR code from your device.
                </p>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  id="qr-file-input"
                />

                <label
                  htmlFor="qr-file-input"
                  className="block cursor-pointer border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-8 transition bg-zinc-50 dark:bg-zinc-800/50"
                >
                  <Scan size={32} className="mx-auto text-emerald-500 mb-2" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {processing ? 'Scanning Image…' : 'Choose Photo or Screenshot'}
                  </span>
                  <span className="block text-[11px] text-zinc-400 mt-1">PNG, JPG, WEBP</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
