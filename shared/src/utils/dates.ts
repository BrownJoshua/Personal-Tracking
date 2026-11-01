/** Calendar helpers. Instants are UTC; a user's "day" is a YYYY-MM-DD string in their time zone. */

export function localDateInZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** ISO weekday 1 (Mon) … 7 (Sun) of an instant in a time zone. */
export function weekdayInZone(date: Date, timeZone: string): number {
  let short: string;
  try {
    short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  } catch {
    short = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(date);
  }
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(short) + 1;
}

export function addDays(localDate: string, days: number): string {
  const d = new Date(`${localDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromLocalDate: string, toLocalDate: string): number {
  return Math.round((Date.parse(`${toLocalDate}T12:00:00Z`) - Date.parse(`${fromLocalDate}T12:00:00Z`)) / 86_400_000);
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
