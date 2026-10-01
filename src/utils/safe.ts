/**
 * Defensive helpers for reading API payloads.
 *
 * The backend is evolving (fields move between comma-strings and JSON arrays,
 * list endpoints occasionally return wrapped objects, nested report sections
 * may be missing). These helpers normalise such values so that render code
 * never crashes on an unexpected shape.
 */

/** Returns `value` if it is an array, unwraps common `{items|results|data: [...]}` envelopes, otherwise `[]`. */
export function asArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['items', 'results', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

/** Returns `value` if it is a plain object, otherwise `{}`. */
export function asObject<T extends Record<string, any> = Record<string, any>>(value: unknown): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : ({} as T);
}

/** Coerces to a finite number, falling back to `fallback`. */
export function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parses an id list that may arrive as a JSON array, a comma separated string,
 * a JSON-encoded array string, or null/undefined.
 */
export function toIdList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
      } catch {
        // fall through to comma parsing
      }
    }
    return trimmed
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [String(value)];
}

/** Formats a number with thousands separators, tolerating missing values. */
export function formatAmount(value: unknown, locale?: string): string {
  return asNumber(value).toLocaleString(locale);
}
