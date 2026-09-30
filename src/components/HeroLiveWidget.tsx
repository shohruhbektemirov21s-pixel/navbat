import React, { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2, Users, ArrowRight } from 'lucide-react';

export const HeroLiveWidget: React.FC = () => {
  // Cycle between 3 micro-demonstration states every 2.8 seconds
  const [step, setStep] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center justify-center max-w-full">
      <div 
        id="hero-live-widget"
        className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 shadow-inner text-slate-200 text-xs transition-all duration-300 backdrop-blur-md"
      >
        {/* Pulsing indicator based on step */}
        {step === 0 && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1 font-medium">
              <span className="text-slate-400">Jonli navbat:</span>
              <span className="text-slate-300">№ 12</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                Sizning navbatingiz: № 13
              </span>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="flex items-center gap-1 font-medium">
              <span className="text-slate-400">Vaqt band qilish:</span>
              <span className="text-blue-300 font-semibold">Bugun, 15:30</span>
              <CheckCircle2 className="w-3 h-3 text-blue-400 ml-0.5" />
              <span className="text-emerald-300 text-[11px] font-semibold bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/50">
                Tasdiqlandi
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex items-center gap-1 font-medium">
              <span className="text-slate-400">Eslatma:</span>
              <span className="text-amber-200 font-semibold">Qabulga 1 soat qoldi</span>
              <span className="text-slate-400 text-[10px] hidden sm:inline">(Telegram / SMS)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
