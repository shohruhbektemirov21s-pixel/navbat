import type { ChangeEvent, KeyboardEvent } from 'react';

/**
 * Guards against letters/symbols being typed into phone number inputs.
 *
 * Allows digits, spaces, parentheses, hyphens and a single leading `+`.
 * Validation of the final format (length, country code, etc.) stays wherever
 * it already lives — this only prevents non-numeric characters at input time.
 */

const ALLOWED_CHARS = /[0-9 ()-]/;

/** Strips everything except digits, spaces, `()`, `-` and a single leading `+`. */
export function sanitizePhoneInput(value: string): string {
  const hasLeadingPlus = value.trimStart().startsWith('+');
  const body = Array.from(value).filter((ch) => ALLOWED_CHARS.test(ch)).join('');
  return hasLeadingPlus ? `+${body}` : body;
}

/**
 * `onChange` handler factory: sanitizes the raw input value before calling `setValue`.
 * Usage: `<input onChange={makePhoneChangeHandler(setPhone)} .../>`
 */
export function makePhoneChangeHandler(setValue: (value: string) => void) {
  return (e: ChangeEvent<HTMLInputElement>) => setValue(sanitizePhoneInput(e.target.value));
}

/**
 * `onKeyDown` guard: blocks a printable, non-numeric keystroke before it ever reaches
 * the input value (defense in depth alongside `sanitizePhoneInput` on change/paste).
 */
export function phoneKeyDownGuard(e: KeyboardEvent<HTMLInputElement>) {
  const { key, ctrlKey, metaKey, altKey } = e;
  if (ctrlKey || metaKey || altKey) return; // allow copy/paste/select-all shortcuts
  if (key.length !== 1) return; // allow Backspace, Delete, arrows, Tab, Enter, etc.
  const isPlus = key === '+' && (e.currentTarget.selectionStart ?? 0) === 0 && !e.currentTarget.value.includes('+');
  if (!ALLOWED_CHARS.test(key) && !isPlus) {
    e.preventDefault();
  }
}
