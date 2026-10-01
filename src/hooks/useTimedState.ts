import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State that clears itself after a delay (toasts, inline success/error banners).
 * Showing a new value restarts the timer; pending timers are cleared on unmount
 * so no state update happens on an unmounted component.
 *
 * @returns [value, show(value, durationMs?), clear]
 */
export function useTimedState<T>(defaultDuration = 4000) {
  const [value, setValue] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setValue(null);
  }, []);

  const show = useCallback(
    (next: T, durationMs: number = defaultDuration) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setValue(next);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setValue(null);
      }, durationMs);
    },
    [defaultDuration]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return [value, show, clear] as const;
}

export type ToastType = 'success' | 'error';
export interface ToastState {
  message: string;
  type: ToastType;
}

/** Convenience wrapper for the `{ message, type }` toast pattern used by the dashboards. */
export function useToast(durationMs = 4000) {
  const [toast, show, clear] = useTimedState<ToastState>(durationMs);
  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => show({ message, type }),
    [show]
  );
  return { toast, showToast, clearToast: clear };
}
