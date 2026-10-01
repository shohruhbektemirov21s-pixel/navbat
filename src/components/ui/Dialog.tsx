import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

/**
 * Promise-based in-app replacements for window.confirm / window.prompt.
 * Native dialogs are blocked or look out of place inside the Telegram WebApp.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: "O'chirilsinmi?", tone: 'danger' }))) return;
 *
 *   const prompt = usePrompt();
 *   const notes = await prompt({ message: 'Izoh', defaultValue: '...' }); // null when cancelled
 */

export interface ConfirmOptions {
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** `danger` renders a red primary button (destructive actions). */
  tone?: 'default' | 'danger';
}

export interface PromptOptions extends ConfirmOptions {
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  /** When true, an empty (whitespace-only) answer cannot be submitted. */
  required?: boolean;
}

type DialogRequest =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function cancelRequest(req: DialogRequest) {
  if (req.kind === 'confirm') req.resolve(false);
  else req.resolve(null);
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [current, setCurrent] = useState<{ request: DialogRequest; id: number } | null>(null);
  const currentRef = useRef<DialogRequest | null>(null);
  const idRef = useRef(0);

  const open = useCallback((req: DialogRequest) => {
    // Only one dialog at a time: a newer request cancels the previous one.
    if (currentRef.current) cancelRequest(currentRef.current);
    currentRef.current = req;
    idRef.current += 1;
    setCurrent({ request: req, id: idRef.current });
  }, []);

  const close = useCallback(() => {
    currentRef.current = null;
    setCurrent(null);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => open({ kind: 'confirm', options, resolve })),
    [open]
  );
  const prompt = useCallback(
    (options: PromptOptions) => new Promise<string | null>((resolve) => open({ kind: 'prompt', options, resolve })),
    [open]
  );

  // Resolve a pending dialog if the provider unmounts.
  useEffect(
    () => () => {
      if (currentRef.current) cancelRequest(currentRef.current);
    },
    []
  );

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {current && (
        <DialogView key={current.id} request={current.request} onDone={close} />
      )}
    </DialogContext.Provider>
  );
};

const DialogView: React.FC<{ request: DialogRequest; onDone: () => void }> = ({ request, onDone }) => {
  const { options } = request;
  const isPrompt = request.kind === 'prompt';
  const promptOptions = isPrompt ? (request.options as PromptOptions) : null;
  const [value, setValue] = useState<string>(promptOptions?.defaultValue ?? '');
  const titleId = useId();
  const descId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  const cancel = useCallback(() => {
    cancelRequest(request);
    onDone();
  }, [request, onDone]);

  const canSubmit = !isPrompt || !promptOptions?.required || value.trim().length > 0;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    if (request.kind === 'confirm') request.resolve(true);
    else request.resolve(value);
    onDone();
  }, [canSubmit, request, value, onDone]);

  useEscapeKey(cancel);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const target = isPrompt ? inputRef.current : primaryRef.current;
    target?.focus();
    if (isPrompt) inputRef.current?.select();
    return () => {
      const prev = previouslyFocused.current as HTMLElement | null;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [isPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter confirms (Shift+Enter still inserts a newline in multiline prompts).
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON') return; // native button activation
      e.preventDefault();
      submit();
    }
    if (e.key === 'Tab') {
      // Minimal focus trap: keep focus inside the dialog.
      const root = e.currentTarget as HTMLElement;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('button, input, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const danger = options.tone === 'danger';
  const Icon = danger ? AlertTriangle : HelpCircle;
  const title = options.title ?? (isPrompt ? "Ma'lumot kiriting" : 'Tasdiqlang');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        role={isPrompt ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={handleKeyDown}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-100 p-5 sm:p-6 animate-in fade-in"
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
              danger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-black text-slate-900">
              {title}
            </h2>
            <div id={descId} className="text-sm text-slate-600 mt-1 leading-relaxed break-words">
              {options.message}
            </div>
          </div>
        </div>

        {promptOptions &&
          (promptOptions.multiline ? (
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={promptOptions.placeholder}
              rows={3}
              aria-label={typeof options.message === 'string' ? options.message : title}
              className="mt-4 w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={promptOptions.placeholder}
              aria-label={typeof options.message === 'string' ? options.message : title}
              className="mt-4 w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ))}

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
          >
            {options.cancelText ?? 'Bekor qilish'}
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {options.confirmText ?? (isPrompt ? 'Saqlash' : 'Tasdiqlash')}
          </button>
        </div>
      </div>
    </div>
  );
};

function useDialogContext(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useConfirm/usePrompt must be used within <DialogProvider>');
  return ctx;
}

/** Returns an async `confirm(options) => Promise<boolean>`. */
export function useConfirm() {
  return useDialogContext().confirm;
}

/** Returns an async `prompt(options) => Promise<string | null>` (null = cancelled). */
export function usePrompt() {
  return useDialogContext().prompt;
}
