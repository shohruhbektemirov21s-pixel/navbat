import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Navigates to the home view ("Bosh sahifa" button). Hidden when omitted. */
  onGoHome?: () => void;
  /** Compact variant for overlays/modals (no large vertical margins). */
  compact?: boolean;
  /** Called after the user dismisses the fallback (e.g. to close a broken modal). */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** A failed lazy chunk (after a redeploy) can only be fixed by reloading the page. */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const text = `${error.name} ${error.message}`;
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    text
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[NavbatBor] UI xatoligi:', error, info.componentStack);
  }

  private handleRetry = () => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  private handleHome = () => {
    this.setState({ error: null });
    this.props.onReset?.();
    this.props.onGoHome?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkError = isChunkLoadError(error);
    const { compact, onGoHome, onReset } = this.props;

    const card = (
      <div
        role="alert"
        className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-xs"
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-slate-900">
          {chunkError ? 'Ilovaning yangi versiyasi mavjud' : 'Kutilmagan xatolik yuz berdi'}
        </h2>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          {chunkError
            ? "Sahifa qismlarini yuklab bo'lmadi. Sahifani yangilab, qayta urinib ko'ring."
            : "Ushbu bo'limni ko'rsatishda muammo chiqdi. Qayta urinib ko'ring yoki bosh sahifaga qayting."}
        </p>
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Qayta urinish
          </button>
          {(onGoHome || onReset) && (
            <button
              type="button"
              onClick={this.handleHome}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              Bosh sahifa
            </button>
          )}
        </div>
      </div>
    );

    if (compact) {
      return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          {card}
        </div>
      );
    }
    return <div className="px-4 my-16 sm:my-20">{card}</div>;
  }
}
