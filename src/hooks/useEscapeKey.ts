import { useEffect, useRef } from 'react';

/**
 * Stack of active Escape handlers. Only the most recently mounted (top-most)
 * layer reacts, so pressing Escape inside a confirm dialog that sits on top
 * of a modal closes only the dialog.
 */
const escapeStack: Array<{ current: () => void }> = [];
let listenerAttached = false;

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return;
  event.preventDefault();
  event.stopPropagation();
  top.current();
}

function attach() {
  if (listenerAttached || typeof document === 'undefined') return;
  document.addEventListener('keydown', handleKeyDown);
  listenerAttached = true;
}

function detachIfIdle() {
  if (!listenerAttached || escapeStack.length > 0) return;
  document.removeEventListener('keydown', handleKeyDown);
  listenerAttached = false;
}

/**
 * Calls `onEscape` when the Escape key is pressed while this layer is the top-most one.
 * Pass `enabled = false` to temporarily opt out (e.g. while a request is in flight).
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean = true) {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return;
    const entry = { current: () => handlerRef.current() };
    escapeStack.push(entry);
    attach();
    return () => {
      const idx = escapeStack.lastIndexOf(entry);
      if (idx !== -1) escapeStack.splice(idx, 1);
      detachIfIdle();
    };
  }, [enabled]);
}
