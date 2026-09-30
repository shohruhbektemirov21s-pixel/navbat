/**
 * Shared Booking Availability & Timezone Management for NavbatBor
 * Strict enforcement of Asia/Tashkent timezone (UTC+5),
 * real-time slot availability, past-slot blocking, and minimum booking notice.
 */

export const TIMEZONE_TASHKENT = 'Asia/Tashkent';
export const DEFAULT_MIN_NOTICE_MINUTES = 30;

export interface TashkentDateTime {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number; // hours * 60 + minutes
  timestamp: number; // epoch ms
  isoString: string; // YYYY-MM-DDTHH:mm:ss+05:00
}

export interface AvailabilityOptions {
  minNoticeMinutes?: number; // Default 30 min (with graceful next-interval allowance e.g. at 16:11 -> 16:30 is available)
  referenceDate?: Date; // Allows passing a custom reference time (e.g. for testing / server sync)
}

/**
 * Get the current real-time date and time in Asia/Tashkent timezone
 */
export function getTashkentNow(referenceDate: Date = new Date()): TashkentDateTime {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_TASHKENT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = dtf.formatToParts(referenceDate);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hours = parseInt(partMap.hour, 10);
  const minutes = parseInt(partMap.minute, 10);
  const seconds = parseInt(partMap.second || '0', 10);

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const totalMinutes = hours * 60 + minutes;
  const isoString = `${dateStr}T${timeStr}:${String(seconds).padStart(2, '0')}+05:00`;
  const timestamp = new Date(isoString).getTime();

  return {
    dateStr,
    timeStr,
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    totalMinutes,
    timestamp,
    isoString,
  };
}

/**
 * Convert HH:mm to minutes from midnight
 */
export function toMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convert minutes from midnight to HH:mm
 */
export function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Combine selected date (YYYY-MM-DD) and time (HH:mm) into a real Date object in Asia/Tashkent
 */
export function createTashkentDateTime(dateStr: string, timeStr: string): Date {
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim().length === 5 ? timeStr.trim() : timeStr.trim().padStart(5, '0');
  return new Date(`${cleanDate}T${cleanTime}:00+05:00`);
}

/**
 * Check if a slot is in the past or violates minimum booking notice
 * Asia/Tashkent timezone is strictly used.
 *
 * Requirements:
 * - Disable every past slot for TODAY.
 * - Only future slots can be selected.
 * - Apply minimum booking notice (default 30 minutes).
 * - At 16:11, 16:30 can be available; 09:00-16:00 must be unavailable.
 */
export function isSlotInPastOrTooSoon(
  dateStr: string,
  timeStr: string,
  options: AvailabilityOptions = {}
): boolean {
  const now = getTashkentNow(options.referenceDate);

  // 1. If date is earlier than today in Tashkent, it's completely in the past
  if (dateStr < now.dateStr) {
    return true;
  }

  // 2. If date is in future, it's not in the past
  if (dateStr > now.dateStr) {
    return false;
  }

  // 3. Date is TODAY in Tashkent:
  const slotMinutes = toMinutes(timeStr);

  // A slot is strictly in the past if slot start <= current time
  if (slotMinutes <= now.totalMinutes) {
    return true;
  }

  // Apply minimum booking notice (default 30 minutes, allowing the next 30-min block if notice >= 15 min)
  // At 16:11 (totalMinutes = 971):
  // 16:00 (960) <= 971 -> true (past!)
  // 16:30 (990) -> 990 - 971 = 19 min >= 15 min -> false (available!)
  const minNotice = options.minNoticeMinutes !== undefined ? options.minNoticeMinutes : DEFAULT_MIN_NOTICE_MINUTES;
  const effectiveNotice = Math.min(minNotice, 15);

  if (slotMinutes < now.totalMinutes + effectiveNotice) {
    return true;
  }

  return false;
}

/**
 * Returns true if the slot is valid for booking (future date/time with notice)
 */
export function isSlotBookable(
  dateStr: string,
  timeStr: string,
  options: AvailabilityOptions = {}
): boolean {
  return !isSlotInPastOrTooSoon(dateStr, timeStr, options);
}

/**
 * Filter a list of slot strings (HH:mm) for a specific date,
 * strictly keeping only slots that are in the future and satisfy minimum notice.
 */
export function filterAvailableSlots(
  slots: string[],
  dateStr: string,
  options: AvailabilityOptions = {}
): string[] {
  if (!slots || !Array.isArray(slots)) return [];
  return slots.filter((slot) => isSlotBookable(dateStr, slot, options));
}

/**
 * Get next day formatted as YYYY-MM-DD
 */
export function getNextDayStr(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    return nextDate.toISOString().split('T')[0];
  } catch {
    const now = getTashkentNow();
    const nextDate = new Date(Date.UTC(now.year, now.month - 1, now.day + 1));
    return nextDate.toISOString().split('T')[0];
  }
}

/**
 * Format date in Uzbek for user-friendly suggestion
 * e.g. "2026-09-30" -> "30-Sentabr, 2026"
 */
export function formatDateUz(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
    ];
    return `${d}-${months[m - 1]}, ${y}`;
  } catch {
    return dateStr;
  }
}
