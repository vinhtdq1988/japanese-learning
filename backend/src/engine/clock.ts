import type { LocalDate } from '../domain/types.js';

// Đồng hồ tiêm được và tiện ích ngày địa phương theo múi giờ IANA (research R11).
// Engine chỉ nhận thời gian qua `Clock` để kiểm thử mô phỏng được nhiều ngày.

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Đồng hồ giả lập cho kiểm thử: đặt giờ cố định và tiến thời gian theo ý muốn. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date | string = '2026-01-01T00:00:00Z') {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(time: Date | string): void {
    this.current = new Date(time);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  advanceMinutes(minutes: number): void {
    this.advanceMs(minutes * 60_000);
  }

  advanceDays(days: number): void {
    this.advanceMs(days * 86_400_000);
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timezone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timezone);
  if (!f) {
    // `en-CA` cho định dạng YYYY-MM-DD.
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatterCache.set(timezone, f);
  }
  return f;
}

/** Múi giờ IANA hợp lệ (ví dụ `Asia/Ho_Chi_Minh`). */
export function isValidTimezone(timezone: string): boolean {
  try {
    dateFormatter(timezone);
    return true;
  } catch {
    return false;
  }
}

/** Ngày địa phương của một thời điểm theo múi giờ của người học. */
export function toLocalDate(instant: Date, timezone: string): LocalDate {
  return dateFormatter(timezone).format(instant);
}

/** Ngày địa phương hiện tại theo đồng hồ tiêm vào. */
export function localToday(clock: Clock, timezone: string): LocalDate {
  return toLocalDate(clock.now(), timezone);
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMs(date: LocalDate): number {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m) throw new Error(`Ngày địa phương không hợp lệ: ${date}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new Error(`Ngày địa phương không hợp lệ: ${date}`);
  }
  return ms;
}

/** Cộng (hoặc trừ, nếu âm) số ngày vào một ngày địa phương. */
export function addDays(date: LocalDate, days: number): LocalDate {
  return new Date(toUtcMs(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Số ngày từ `from` đến `to` (dương nếu `to` sau `from`). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** Danh sách ngày trong nửa khoảng `[from, to)`; rỗng nếu `to <= from`. */
export function daysInRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const n = diffDays(from, to);
  return Array.from({ length: Math.max(0, n) }, (_, i) => addDays(from, i));
}
