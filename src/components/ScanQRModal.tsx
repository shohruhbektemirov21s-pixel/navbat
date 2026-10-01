import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, RefreshCw, Upload, CheckCircle2, AlertCircle, 
  Smartphone, Zap, ZapOff, SwitchCamera
} from 'lucide-react';
import jsQR from 'jsqr';
import { api } from '../api';
import { BusinessItem } from '../types';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ScanQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBusiness: (business: BusinessItem) => void;
}

export type CameraStatus = 
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'unsupported'
  | 'error';

export const ScanQRModal: React.FC<ScanQRModalProps> = ({
  isOpen,
  onClose,
  onSelectBusiness,
}) => {
  useEscapeKey(onClose, isOpen);

  // Camera & Stream references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const lastScannedCodeRef = useRef<string | null>(null);

  // States
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  // Scanning / Resolving states
  const [resolving, setResolving] = useState<boolean>(false);
  const [matchedBusinessName, setMatchedBusinessName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual code input mode
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');

  // Audio & Haptic feedback
  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      }
    } catch (e) {}

    if (navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }
  };

  // Stop camera tracks cleanly
  const stopCamera = () => {
    isScanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  };

  // Request & Start Camera (handles permissions cleanly)
  const startCamera = async () => {
    stopCamera();
    setErrorMessage(null);
    setCameraStatus('requesting');

    // 1. Check browser mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('unsupported');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        setHasTorch(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
        setCameraStatus('active');
        isScanningRef.current = true;
        startScanningLoop();
      }
    } catch (err: any) {
      console.warn('Camera request error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraStatus('error');
        setErrorMessage('Qurilmada kamera topilmadi.');
      } else {
        setCameraStatus('error');
        setErrorMessage('Kameraga ulanishda xatolik yuz berdi.');
      }
    }
  };

  // Torch Toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const next = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: next }],
        });
        setTorchOn(next);
      } catch (e) {
        console.warn('Torch toggle error:', e);
      }
    }
  };

  // Switch Facing Mode
  const toggleFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Continuous Frame Analysis with jsQR and BarcodeDetector
  const startScanningLoop = () => {
    let lastTime = 0;

    const scanFrame = async () => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused && !video.ended) {
        const now = performance.now();
        if (now - lastTime > 110) {
          lastTime = now;

          let detectedText: string | null = null;

          // 1. Try Native BarcodeDetector if available
          if ('BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
              const barcodes = await detector.detect(video);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                detectedText = barcodes[0].rawValue;
              }
            } catch (e) {}
          }

          // 2. Fallback to jsQR via offscreen canvas
          if (!detectedText && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              const width = video.videoWidth || 640;
              const height = video.videoHeight || 480;
              if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
              }
              ctx.drawImage(video, 0, 0, width, height);
              const imageData = ctx.getImageData(0, 0, width, height);
              const code = jsQR(imageData.data, width, height, {
                inversionAttempts: 'dontInvert',
              });
              if (code && code.data) {
                detectedText = code.data;
              }
            }
          }

          if (detectedText) {
            // Prevent duplicate scans
            if (detectedText !== lastScannedCodeRef.current) {
              lastScannedCodeRef.current = detectedText;
              isScanningRef.current = false;
              stopCamera();
              handleProcessScannedCode(detectedText);
              return;
            }
          }
        }
      }

      if (isScanningRef.current) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Process and Resolve Detected QR Code
  const handleProcessScannedCode = async (rawCode: string) => {
    playSuccessSound();
    setResolving(true);
    setErrorMessage(null);
    setMatchedBusinessName(null);

    try {
      const res = await api.resolveQRCode(rawCode);
      if (res && res.type === 'business' && res.business) {
        setMatchedBusinessName(res.business.name);
        // Direct seamless navigation to business & queue
        setTimeout(() => {
          onSelectBusiness(res.business);
          onClose();
        }, 500);
        return;
      } else if (res && res.type === 'booking' && res.booking) {
        setMatchedBusinessName(res.booking.business_name || 'Bron topildi');
        setTimeout(() => {
          onClose();
        }, 800);
        return;
      } else {
        setErrorMessage('QR-kod yaroqsiz yoki NavbatBor tizimiga tegishli emas.');
      }
    } catch (err: any) {
      // Fallback: try direct business slug or ID lookup
      let slug = rawCode.trim();
      if (slug.includes('#business/')) slug = slug.split('#business/')[1];
      else if (slug.includes('/b/')) slug = slug.split('/b/')[1];
      else if (slug.includes('/business/')) slug = slug.split('/business/')[1];
      slug = (slug || '').split(/[?#/]/)[0];

      try {
        const bizData = await api.getBusinessBySlug(slug);
        if (bizData?.business) {
          setMatchedBusinessName(bizData.business.name);
          setTimeout(() => {
            onSelectBusiness(bizData.business);
            onClose();
          }, 500);
          return;
        }
      } catch (e2) {}

      setErrorMessage('QR-kod yaroqsiz yoki NavbatBor tizimiga tegishli emas.');
    } finally {
      setResolving(false);
    }
  };

  // File Upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResolving(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setResolving(false);
          setErrorMessage('Rasmni qayta ishlashda xatolik yuz berdi.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, img.width, img.height);
        if (code && code.data) {
          handleProcessScannedCode(code.data);
        } else {
          setResolving(false);
          setErrorMessage('QR-kod yaroqsiz yoki NavbatBor tizimiga tegishli emas.');
        }
      };
      img.onerror = () => {
        setResolving(false);
        setErrorMessage('Rasmni yuklab bo‘lmadi.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Reset and restart scanner
  const handleResetScanner = () => {
    lastScannedCodeRef.current = null;
    setErrorMessage(null);
    setMatchedBusinessName(null);
    setResolving(false);
    startCamera();
  };

  // Lock body scroll and control lifecycle
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      startCamera();

      return () => {
        document.body.style.overflow = prevOverflow;
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-sm animate-fadeIn p-0 sm:p-4"
      aria-modal="true"
      role="dialog"
      aria-label="QR Scanner"
    >
      {/* Hidden working canvas for video frame extraction */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-12 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Fixed Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
              <Camera className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                QR Scanner
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                QR orqali navbat oling
              </p>
            </div>
          </div>

          <button
            id="close-scan-qr-modal-btn"
            onClick={onClose}
            aria-label="Yopish"
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 active:scale-95 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          {/* STATE 1: RESOLVING SCANNED CODE */}
          {resolving && (
            <div className="py-12 text-center space-y-3">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">QR-kod tekshirilmoqda...</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                NavbatBor tizimidan muassasa aniqlanmoqda
              </p>
            </div>
          )}

          {/* STATE 2: SUCCESS MATCHED */}
          {!resolving && matchedBusinessName && (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3 animate-fadeIn">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                  Muassasa aniqlandi
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {matchedBusinessName}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Navbat sahifasiga o‘tilmoqda...
                </p>
              </div>
            </div>
          )}

          {/* STATE 3: INVALID QR OR RESOLVE ERROR */}
          {!resolving && errorMessage && (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 animate-fadeIn">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-rose-900">QR-kod xatosi</h4>
                <p className="text-xs text-rose-700 mt-1 max-w-xs mx-auto leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  id="qr-try-again-btn"
                  onClick={handleResetScanner}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm min-h-[42px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Qayta urinish</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: CAMERA ACTIVE / VIEW FINDER */}
          {!resolving && !matchedBusinessName && !errorMessage && (
            <div className="space-y-4">
              {/* Camera Preview Box */}
              <div className="relative aspect-[4/3] sm:aspect-square max-h-[35vh] sm:max-h-[300px] w-full max-w-[340px] mx-auto rounded-2xl overflow-hidden bg-slate-950 shadow-inner flex items-center justify-center">
                {cameraStatus === 'active' ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />

                    {/* Viewfinder Reticle Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                      <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-white/40 rounded-2xl overflow-hidden">
                        {/* Corner markers */}
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                        {/* Laser scan line */}
                        <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 shadow-[0_0_12px_#3b82f6] animate-bounce-laser" />
                      </div>
                    </div>

                    {/* Quick controls over video (Torch & Flip) */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-2.5 rounded-full backdrop-blur-md transition cursor-pointer ${
                            torchOn ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-black/50 text-white hover:bg-black/70'
                          }`}
                          title="Chiroq (Flash)"
                        >
                          {torchOn ? <Zap className="w-4 h-4 fill-slate-950" /> : <ZapOff className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={toggleFacing}
                        className="p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition cursor-pointer"
                        title="Kamerani almashtirish"
                      >
                        <SwitchCamera className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Point Camera Prompt */}
                    <div className="absolute bottom-3 inset-x-3 text-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-white text-[11px] font-medium shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        Kamerani QR-kodga qarating
                      </span>
                    </div>
                  </>
                ) : cameraStatus === 'denied' ? (
                  /* PERMISSION DENIED UI (Requirement 1) */
                  <div className="p-6 text-center text-white space-y-3">
                    <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">
                        Kameraga ruxsat berilmagan.
                      </h4>
                      <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                        Sozlamalardan kameraga ruxsat bering va qayta urinib ko‘ring.
                      </p>
                    </div>
                    <button
                      type="button"
                      id="qr-permission-retry-btn"
                      onClick={startCamera}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-2 min-h-[42px] shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Qayta urinish</span>
                    </button>
                  </div>
                ) : cameraStatus === 'unsupported' ? (
                  /* UNSUPPORTED CAMERA (Requirement 1) */
                  <div className="p-6 text-center text-white space-y-2">
                    <Camera className="w-10 h-10 text-slate-500 mx-auto" />
                    <h4 className="text-sm font-bold text-white">
                      Kamerangiz ushbu qurilmada qo‘llab-quvvatlanmaydi.
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Quyidagi rasm yuklash yoki kod kiritish usullaridan foydalaning.
                    </p>
                  </div>
                ) : cameraStatus === 'requesting' ? (
                  /* REQUESTING PERMISSION STATE */
                  <div className="p-6 text-center text-white space-y-3">
                    <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">
                      Kameraga ruxsat so‘ralmoqda...
                    </p>
                  </div>
                ) : (
                  /* OTHER CAMERA ERROR */
                  <div className="p-6 text-center text-white space-y-3">
                    <Camera className="w-10 h-10 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300">
                      {errorMessage || 'Kameraga ulanishda xatolik'}
                    </p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Qayta urinish</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Reliable Fallback Options: Gallery upload & Manual entry */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  id="scan-upload-image-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-800 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer min-h-[44px]"
                >
                  <Upload className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Galeriyadan tanlash</span>
                </button>

                <button
                  type="button"
                  id="scan-manual-code-btn"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-800 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer min-h-[44px]"
                >
                  <Smartphone className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Kodni qo‘lda kiritish</span>
                </button>
              </div>

              {/* Manual input form if toggled */}
              {showManualInput && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualCode.trim()) {
                      handleProcessScannedCode(manualCode.trim());
                    }
                  }}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-fadeIn"
                >
                  <label className="text-[11px] font-bold text-slate-700">
                    Muassasa slugi yoki QR kodi:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Masalan: shifo-nur-klinikasi"
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!manualCode.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer min-h-[38px]"
                    >
                      OK
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
