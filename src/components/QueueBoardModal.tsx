import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, X, Volume2, VolumeX, RefreshCw, Clock, Users, Building2 } from 'lucide-react';
import { api } from '../api';
import { PublicQueueBoard } from '../types';

interface QueueBoardModalProps {
  businessSlug: string;
  businessName?: string;
  onClose: () => void;
}

export const QueueBoardModal: React.FC<QueueBoardModalProps> = ({
  businessSlug,
  businessName,
  onClose,
}) => {
  const [data, setData] = useState<PublicQueueBoard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCalledIdRef = useRef<string | null>(null);

  // Play synthetic chime sound using Web Audio API
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.warn('Audio chime could not play', e);
    }
  };

  const fetchData = async () => {
    try {
      const res = await api.getPublicQueueBoard(businessSlug);
      setData(res);

      // Check if there is a newly called ticket to trigger chime
      if (res.called && res.called.length > 0) {
        const topCalled = res.called[0];
        if (topCalled.id !== lastCalledIdRef.current) {
          lastCalledIdRef.current = topCalled.id;
          if (soundEnabled) {
            playChime();
          }
        }
      }
    } catch (err) {
      console.error('Error fetching queue board:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // refresh every 4s

    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, [businessSlug, soundEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const serving = data?.serving || [];
  const called = data?.called || [];
  const waiting = data?.waiting || [];

  return (
    <div
      ref={containerRef}
      id="queue-tv-board"
      className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none"
    >
      {/* Top Header Bar */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
            NB
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>{data?.business?.name || businessName || 'NavbatBor'}</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {data?.business?.district ? `${data.business.district}, ` : ''}{data?.business?.address || 'Elektron Navbat Tablosi'}
            </p>
          </div>
        </div>

        {/* Right Side: Clock & TV Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 font-mono text-lg font-bold text-amber-400">
            <Clock className="w-5 h-5 text-amber-400" />
            <span>{currentTime || '00:00:00'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="tv-sound-toggle-btn"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playChime();
              }}
              title={soundEnabled ? 'Ovozni o‘chirish' : 'Ovozni yoqish'}
              className={`p-2.5 rounded-xl border transition ${
                soundEnabled
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <button
              id="tv-fullscreen-btn"
              onClick={toggleFullscreen}
              title="To‘liq ekran (TV rejimi)"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            <button
              id="tv-close-btn"
              onClick={onClose}
              title="Yopish"
              className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Board Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        {/* LEFT COLUMN: ACTIVE SERVING & CALLED (Huge Display) */}
        <div className="lg:col-span-8 flex flex-col gap-6 h-full">
          {/* Top: Now Serving Banner */}
          <div className="flex-1 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 text-xs md:text-sm font-black uppercase tracking-wider">
                QABUL QILINMOQDA (NOW SERVING)
              </span>
              <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Jonli
              </span>
            </div>

            {serving.length === 0 && called.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-4xl md:text-6xl font-black text-slate-700 tracking-wider">---</p>
                <p className="text-slate-400 text-base mt-4 font-medium">Hozirda qabuldagi mijozlar yo‘q</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-auto py-4">
                {(serving.length > 0 ? serving : called).slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/80 border-2 border-emerald-500/50 rounded-2xl p-6 text-center shadow-inner"
                  >
                    <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black font-mono tracking-tight text-emerald-400 animate-pulse">
                      {item.queue_number}
                    </div>
                    <div className="mt-3 text-lg md:text-xl font-bold text-white">
                      {item.customer_name}
                    </div>
                    <div className="text-xs md:text-sm text-emerald-300/80 font-medium mt-1">
                      {item.service_name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
              <span>Navbatingiz kelganda audio ovoz yangraydi</span>
              <span>NavbatBor Live Kiosk</span>
            </div>
          </div>

          {/* Bottom: Called (Please Enter) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              XONAGA CHAQIRILMOQDA
            </h3>

            {called.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-2">Hozirda yangi chaqirilganlar yo‘q</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {called.map((c) => (
                  <div
                    key={c.id}
                    className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 text-center animate-bounce"
                  >
                    <div className="text-2xl md:text-3xl font-black font-mono text-amber-400">{c.queue_number}</div>
                    <div className="text-xs font-bold text-slate-200 mt-1 truncate">{c.customer_name}</div>
                    <div className="text-[10px] text-amber-300/80 truncate mt-0.5">{c.service_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: WAITING QUEUE LIST */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col h-full shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Kutayotganlar</span>
              </h2>
              <p className="text-xs text-slate-400">Keyingi navbatlar ro‘yxati</p>
            </div>
            <div className="px-3 py-1 bg-indigo-950/60 border border-indigo-700/60 text-indigo-300 font-mono font-black text-sm rounded-xl">
              {waiting.length} kishi
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 py-4 pr-1">
            {waiting.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                Kutish zalida hech kim yo‘q
              </div>
            ) : (
              waiting.map((w, idx) => (
                <div
                  key={w.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                    idx === 0
                      ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-xs font-mono font-bold text-slate-500">{idx + 1}.</span>
                    <span className="text-xl font-black font-mono text-white tracking-wide">{w.queue_number}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{w.customer_name}</div>
                      <div className="text-[10px] text-slate-400">{w.service_name}</div>
                    </div>
                  </div>

                  {idx === 0 && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500 text-white animate-pulse">
                      Keyingi
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer of Sidebar */}
          <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span>Har 4 soniyada yangilanadi</span>
            </span>
            <span className="font-mono text-slate-400 text-[11px]">{data?.lastUpdated?.slice(11, 19) || ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
