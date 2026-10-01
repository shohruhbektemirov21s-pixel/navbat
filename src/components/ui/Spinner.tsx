import React from 'react';

/** Small centered spinner used as the Suspense fallback for lazily loaded views. */
export const PageSpinner: React.FC<{ label?: string }> = ({ label = 'Yuklanmoqda...' }) => (
  <div className="py-24 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
    <span className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin" aria-hidden="true" />
    <span className="text-xs text-slate-400 font-medium">{label}</span>
  </div>
);

/** Fullscreen translucent spinner for lazily loaded modals. */
export const OverlaySpinner: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs" role="status" aria-live="polite">
    <span className="w-9 h-9 rounded-full border-[3px] border-white/30 border-t-white animate-spin" aria-hidden="true" />
    <span className="sr-only">Yuklanmoqda...</span>
  </div>
);
