import type { GoalType } from "../constants";
import { addDays, daysBetween } from "./dates";

export interface DatedValue {
  date: string; // YYYY-MM-DD
  value: number;
}

/** Monday (YYYY-MM-DD) of the ISO week containing `localDate`. */
export function weekStart(localDate: string): string {
  const d = new Date(`${localDate}T12:00:00Z`);
  const iso = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(localDate, -iso);
}

/** One value per day (the day's mean), sorted ascending. */
export function dailyMeans(points: DatedValue[]): DatedValue[] {
  const byDay = new Map<string, number[]>();
  for (const p of points) byDay.set(p.date, [...(byDay.get(p.date) ?? []), p.value]);
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, vs]) => ({ date, value: round(vs.reduce((a, b) => a + b, 0) / vs.length, 2) }));
}

/**
 * Trailing moving average over `windowDays` calendar days (not N entries), so gaps in
 * logging don't stretch the window. Returns one value per input day.
 */
export function trailingAverage(points: DatedValue[], windowDays = 7): DatedValue[] {
  const days = dailyMeans(points);
  return days.map((p) => {
    const inWindow = days.filter((q) => q.date <= p.date && daysBetween(q.date, p.date) < windowDays);
    return { date: p.date, value: round(inWindow.reduce((a, q) => a + q.value, 0) / inWindow.length, 2) };
  });
}

/** Least-squares slope in units per week. Null with fewer than 2 distinct days. */
export function weeklyRate(points: DatedValue[]): number | null {
  const days = dailyMeans(points);
  if (days.length < 2) return null;
  const x0 = days[0]!.date;
  const xs = days.map((d) => daysBetween(x0, d.date));
  const ys = days.map((d) => d.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (den === 0) return null;
  const slopePerDay = xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0) / den;
  return round(slopePerDay * 7, 2);
}

export const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

// ---- Weekly recommendations ----------------------------------------------

export interface WeeklyInputs {
  goalType: GoalType | null;
  nutrition: { daysLogged: number; avgCalories: number | null; avgProtein: number | null; targetCalories: number | null; targetProtein: number | null };
  training: { sessions: number; plannedPerWeek: number | null; personalRecords: number; discomfortReports: number };
  body: { weighIns: number; avgWeightKg: number | null; prevAvgWeightKg: number | null; waistChangeCm: number | null };
}

export interface Recommendation {
  kind: "LOGGING" | "NUTRITION" | "TRAINING" | "BODY" | "RECOVERY" | "PRAISE";
  tone: "positive" | "neutral" | "attention";
  text: string;
}

/** Expected weekly body-weight change, as % of body weight, per goal. */
const RATE_BANDS: Record<GoalType, [number, number]> = {
  FAT_LOSS: [-1.0, -0.25],
  MUSCLE_GAIN: [0.1, 0.5],
  RECOMPOSITION: [-0.5, 0.25],
};

/**
 * Plain, conservative coaching notes from a week of the member's own data.
 * Never diagnostic, never prescribes exact calorie changes — targets are reviewed with a coach.
 */
export function weeklyRecommendations(w: WeeklyInputs): Recommendation[] {
  const out: Recommendation[] = [];
  const n = w.nutrition;

  if (n.daysLogged < 5) {
    out.push({ kind: "LOGGING", tone: "neutral", text: `Food was logged on ${n.daysLogged} of 7 days. Logging at least 5 days makes the averages reliable.` });
  } else if (n.targetProtein && n.avgProtein !== null) {
    const pct = n.avgProtein / n.targetProtein;
    if (pct < 0.9) out.push({ kind: "NUTRITION", tone: "attention", text: `Protein averaged ${Math.round(n.avgProtein)} g against a ${n.targetProtein} g target. Adding a protein source to one more meal usually closes the gap.` });
    else out.push({ kind: "PRAISE", tone: "positive", text: `Protein averaged ${Math.round(n.avgProtein)} g — on target.` });
  }
  if (n.daysLogged >= 5 && n.targetCalories && n.avgCalories !== null) {
    const diff = (n.avgCalories - n.targetCalories) / n.targetCalories;
    if (Math.abs(diff) > 0.15) {
      out.push({ kind: "NUTRITION", tone: "attention", text: `Calories averaged ${Math.round(n.avgCalories)} kcal, ${diff > 0 ? "above" : "below"} the ${n.targetCalories} kcal target by more than 15%.` });
    }
  }

  const t = w.training;
  if (t.plannedPerWeek) {
    if (t.sessions >= t.plannedPerWeek) out.push({ kind: "PRAISE", tone: "positive", text: `All ${t.plannedPerWeek} planned workouts done.` });
    else out.push({ kind: "TRAINING", tone: t.sessions === 0 ? "attention" : "neutral", text: `${t.sessions} of ${t.plannedPerWeek} planned workouts completed.` });
  }
  if (t.personalRecords > 0) out.push({ kind: "PRAISE", tone: "positive", text: `${t.personalRecords} personal record${t.personalRecords > 1 ? "s" : ""} this week.` });
  if (t.discomfortReports >= 2) {
    out.push({ kind: "RECOVERY", tone: "attention", text: `Discomfort was reported ${t.discomfortReports} times. If it persists, reduce the load on that movement and check with a qualified professional.` });
  }

  const b = w.body;
  if (b.weighIns < 3) {
    out.push({ kind: "LOGGING", tone: "neutral", text: `${b.weighIns} weigh-in${b.weighIns === 1 ? "" : "s"} this week. Three or more morning weigh-ins give a clearer trend.` });
  } else if (w.goalType && b.avgWeightKg !== null && b.prevAvgWeightKg !== null) {
    const pct = ((b.avgWeightKg - b.prevAvgWeightKg) / b.prevAvgWeightKg) * 100;
    const [lo, hi] = RATE_BANDS[w.goalType];
    const change = round(b.avgWeightKg - b.prevAvgWeightKg, 1);
    const desc = `Average weight ${change >= 0 ? "+" : ""}${change} kg vs last week (${round(pct, 2)}%).`;
    if (pct < lo) {
      const why = w.goalType === "MUSCLE_GAIN" ? "Weight isn't trending up as intended for muscle gain" : "That's faster loss than intended for your goal";
      out.push({ kind: "BODY", tone: "attention", text: `${desc} ${why} — one week can be noise, so review targets with your coach if it repeats.` });
    } else if (pct > hi) {
      const why = w.goalType === "FAT_LOSS" ? "That's not the downward trend intended for fat loss" : "That's faster gain than intended for your goal";
      out.push({ kind: "BODY", tone: "attention", text: `${desc} ${why} — one week can be noise, so watch next week too.` });
    }
    else out.push({ kind: "BODY", tone: "positive", text: `${desc} In the expected range for your goal.` });
  }
  if (b.waistChangeCm !== null && b.waistChangeCm <= -0.5 && w.goalType !== "MUSCLE_GAIN") {
    out.push({ kind: "PRAISE", tone: "positive", text: `Waist down ${Math.abs(b.waistChangeCm)} cm.` });
  }
  return out;
}
