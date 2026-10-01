import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { api } from '../api';

const POLL_INTERVAL_MS = 18000;
const STEP_INTERVAL_MS = 4500;

interface LiveStats {
  activeQueueCount: number;
  todaysBookingsCount: number;
}

/** Small live-stats pill shown in the hero section. Polls real backend numbers. */
export const HeroLiveWidget: React.FC = () => {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [step, setStep] = useState<number>(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchStats = async () => {
      try {
        const res = await api.getPublicStats();
        if (!mountedRef.current) return;
        setStats({
          activeQueueCount: Number(res?.activeQueueCount) || 0,
          todaysBookingsCount: Number(res?.todaysBookingsCount) || 0,
        });
      } catch {
        // Resilient: keep whatever we last had (or nothing) — never crash the homepage.
      }
    };

    fetchStats();
    const poll = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 2);
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Nothing to show yet (first load still pending, or every poll so far failed).
  if (!stats) return null;

  return (
    <div className="inline-flex items-center justify-center max-w-full">
      <div
        id="hero-live-widget"
        className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 shadow-inner text-slate-200 text-xs transition-all duration-300 backdrop-blur-md"
      >
        {step === 0 && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1 font-medium">
              <span className="text-slate-400">Hozir faol:</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                {stats.activeQueueCount} ta navbat
              </span>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="flex items-center gap-1 font-medium">
              <span className="text-slate-400">Bugun band qilindi:</span>
              <span className="text-blue-300 font-bold bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/50">
                {stats.todaysBookingsCount} ta
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
