/** The pace planner: spread the 95 rounds over a number of days from a start date (spec 9.5). */

export const TOTAL_ROUNDS = 95;

export interface Pace {
  /** The first day, as YYYY-MM-DD. */
  start: string;
  days: number;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86_400_000;

const utc = (iso: string): number => {
  const m = ISO.exec(iso);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export function validPace(p: Pace): boolean {
  return Number.isFinite(utc(p.start)) && Number.isInteger(p.days) && p.days >= 1 && p.days <= 365;
}

/** Today in the knitter's own time zone, as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * DAY).toISOString().slice(0, 10);
}

/** Dates as in the style guide: 28 October 2026. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(utc(iso)));
}

/** Rounds that should be finished by the end of day `day` (1 to days). */
export function doneByEndOfDay(days: number, day: number, total = TOTAL_ROUNDS): number {
  return Math.round((total * Math.min(Math.max(day, 0), days)) / days);
}

export interface DayPlan {
  day: number;
  date: string;
  /** The rounds to knit this day. `from` is more than `to` on a day with none. */
  from: number;
  to: number;
}

export function plan(p: Pace, total = TOTAL_ROUNDS): DayPlan[] {
  return Array.from({ length: p.days }, (_, i) => ({
    day: i + 1,
    date: addDays(p.start, i),
    from: doneByEndOfDay(p.days, i, total) + 1,
    to: doneByEndOfDay(p.days, i + 1, total),
  }));
}

/** Days since the start: 0 on the first day, negative before it. */
export function dayIndex(p: Pace, today: string): number {
  return Math.round((utc(today) - utc(p.start)) / DAY);
}

export interface Standing {
  /** Rounds that should be done by the end of today. */
  target: number;
  /** Rounds done minus the target: positive is ahead. */
  diff: number;
  text: string;
}

export function standing(p: Pace, completed: number, today: string, total = TOTAL_ROUNDS): Standing {
  const i = dayIndex(p, today);
  if (i < 0) return { target: 0, diff: completed, text: i === -1 ? "The plan starts tomorrow." : `The plan starts in ${-i} days.` };
  const target = doneByEndOfDay(p.days, i + 1, total);
  const diff = completed - target;
  const over = i >= p.days;
  const how = diff === 0 ? "on track" : diff > 0 ? `${diff} ${diff === 1 ? "round" : "rounds"} ahead` : `${-diff} ${-diff === 1 ? "round" : "rounds"} behind`;
  if (over && completed >= total) return { target, diff, text: "The plan is finished, and so are you." };
  return { target, diff, text: over ? `The plan ended ${i - p.days + 1 === 1 ? "yesterday" : `${i - p.days + 1} days ago`}: ${how}.` : `By the end of today, aim for round ${target}: ${how}.` };
}
