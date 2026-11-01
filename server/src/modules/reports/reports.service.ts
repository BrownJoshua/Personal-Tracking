import {
  addDays,
  localDateInZone,
  round,
  summarizeSets,
  trailingAverage,
  weekStart,
  weeklyRate,
  weeklyRecommendations,
  type BodyTrendDTO,
  type StrengthExerciseSummaryDTO,
  type StrengthSeriesDTO,
  type TrainingWeekDTO,
  type WeeklyReportDTO,
} from "@recomptrack/shared";
import { HttpError } from "../../utils/httpError";
import { idOf, toObjectId } from "../../utils/serialize";
import { BodyMeasurement } from "../measurements/bodyMeasurement.model";
import { FoodLog } from "../nutrition/nutrition.models";
import { currentTarget } from "../targets/targets.service";
import { UserGoal } from "../users/userGoal.model";
import { UserPreference } from "../users/userPreference.model";
import { ExerciseLog, UserWorkoutAssignment, WorkoutPlan, WorkoutSession } from "../workouts/workout.models";

/**
 * Read-only analytics over one user's own records. Every query is scoped by `userId`;
 * the admin report reuses these functions only after checking the member's consent.
 */

export async function timezoneOf(userId: string) {
  return (await UserPreference.findOne({ userId }).select({ timezone: 1 }).lean())?.timezone ?? "UTC";
}

/** UTC instant bounds for a range of local days (padded by a day to cover any time zone). */
function instantRange(fromLocal: string, toLocal: string) {
  return { $gte: new Date(`${addDays(fromLocal, -1)}T00:00:00Z`), $lt: new Date(`${addDays(toLocal, 2)}T00:00:00Z`) };
}

// ---- Body ---------------------------------------------------------------

export async function bodyTrend(userId: string, days: number): Promise<BodyTrendDTO> {
  const tz = await timezoneOf(userId);
  const to = localDateInZone(new Date(), tz);
  const from = addDays(to, -(days - 1));
  // Load 6 extra days so the first points of the window have a full 7-day average.
  const [rows, goal] = await Promise.all([
    BodyMeasurement.find({ userId, recordedAt: instantRange(addDays(from, -6), to) }).sort({ recordedAt: 1 }).lean(),
    UserGoal.findOne({ userId, status: "ACTIVE" }).lean(),
  ]);
  const local = rows.map((r) => ({ date: localDateInZone(r.recordedAt, tz), m: r.measurements }));
  const weightPts = local.filter((r) => typeof r.m.weightKg === "number").map((r) => ({ date: r.date, value: r.m.weightKg as number }));
  const avg = new Map(trailingAverage(weightPts, 7).map((p) => [p.date, p.value]));
  const daily = new Map<string, number[]>();
  for (const p of weightPts) daily.set(p.date, [...(daily.get(p.date) ?? []), p.value]);
  const weight = [...daily.entries()]
    .filter(([d]) => d >= from && d <= to)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, vs]) => ({ date, valueKg: round(vs.reduce((a, b) => a + b, 0) / vs.length, 2), average7d: avg.get(date)! }));
  const waist = local
    .filter((r) => typeof r.m.waistCm === "number" && r.date >= from && r.date <= to)
    .map((r) => ({ date: r.date, valueCm: r.m.waistCm as number }));
  return {
    range: { from, to },
    weight,
    waist,
    weeklyRateKg: weeklyRate(weightPts.filter((p) => p.date >= from)),
    goalType: goal?.goalType ?? null,
    targetWeightKg: goal?.targetWeightKg ?? null,
  };
}

// ---- Strength -----------------------------------------------------------

type SessionInfo = { _id: unknown; completedAt: Date | null };

async function completedSessionMap(userId: string, since?: Date) {
  const sessions = await WorkoutSession.find({ userId, status: "COMPLETED", ...(since ? { completedAt: { $gte: since } } : {}) })
    .select({ completedAt: 1 })
    .lean();
  return new Map<string, SessionInfo>(sessions.map((s) => [idOf(s._id), s]));
}

export async function strengthSummary(userId: string): Promise<StrengthExerciseSummaryDTO[]> {
  const sessions = await completedSessionMap(userId);
  const logs = await ExerciseLog.find({ userId, workoutSessionId: { $in: [...sessions.keys()].map(toObjectId) } })
    .select({ exerciseId: 1, exerciseNameSnapshot: 1, sets: 1, workoutSessionId: 1 })
    .lean();
  const byExercise = new Map<string, { name: string; points: { at: Date; oneRm: number }[] }>();
  for (const l of logs) {
    const st = summarizeSets(l.sets);
    if (st.workingSets === 0) continue;
    const at = sessions.get(idOf(l.workoutSessionId))?.completedAt;
    if (!at) continue;
    const k = idOf(l.exerciseId);
    const e = byExercise.get(k) ?? { name: l.exerciseNameSnapshot, points: [] };
    e.points.push({ at, oneRm: st.bestOneRepMax });
    byExercise.set(k, e);
  }
  return [...byExercise.entries()]
    .map(([exerciseId, e]) => {
      const pts = e.points.sort((a, b) => a.at.getTime() - b.at.getTime());
      return {
        exerciseId,
        exerciseName: e.name,
        sessions: pts.length,
        lastPerformedAt: pts[pts.length - 1]!.at.toISOString(),
        bestOneRepMax: Math.max(...pts.map((p) => p.oneRm)),
        latestOneRepMax: pts[pts.length - 1]!.oneRm,
        firstOneRepMax: pts[0]!.oneRm,
      };
    })
    .sort((a, b) => (a.lastPerformedAt < b.lastPerformedAt ? 1 : -1));
}

export async function strengthSeries(userId: string, exerciseId: string, days: number): Promise<StrengthSeriesDTO> {
  const tz = await timezoneOf(userId);
  const since = new Date(Date.now() - days * 86_400_000);
  const sessions = await completedSessionMap(userId, since);
  const logs = await ExerciseLog.find({ userId, exerciseId, workoutSessionId: { $in: [...sessions.keys()].map(toObjectId) } }).lean();
  if (logs.length === 0) {
    const any = await ExerciseLog.findOne({ userId, exerciseId }).select({ exerciseNameSnapshot: 1 }).lean();
    if (!any) throw HttpError.notFound("Exercise history");
    return { exerciseId, exerciseName: any.exerciseNameSnapshot, points: [] };
  }
  const bySession = new Map<string, StrengthSeriesDTO["points"][number] & { at: number }>();
  for (const l of logs) {
    const st = summarizeSets(l.sets);
    if (st.workingSets === 0) continue;
    const sid = idOf(l.workoutSessionId);
    const at = sessions.get(sid)!.completedAt!;
    const cur = bySession.get(sid);
    // The same exercise can appear twice in one session — merge it.
    bySession.set(sid, {
      at: at.getTime(),
      date: localDateInZone(at, tz),
      sessionId: sid,
      bestOneRepMax: Math.max(cur?.bestOneRepMax ?? 0, st.bestOneRepMax),
      heaviestKg: Math.max(cur?.heaviestKg ?? 0, st.heaviestKg),
      volumeKg: round((cur?.volumeKg ?? 0) + st.volumeKg, 1),
      workingSets: (cur?.workingSets ?? 0) + st.workingSets,
    });
  }
  return {
    exerciseId,
    exerciseName: logs[logs.length - 1]!.exerciseNameSnapshot,
    // Order by completion time, so two sessions on the same day stay in the order they happened.
    points: [...bySession.values()].sort((a, b) => a.at - b.at).map(({ at: _at, ...p }) => p),
  };
}

// ---- Training weeks -----------------------------------------------------

export async function trainingWeeks(userId: string, weeks: number): Promise<TrainingWeekDTO[]> {
  const tz = await timezoneOf(userId);
  const thisWeek = weekStart(localDateInZone(new Date(), tz));
  const first = addDays(thisWeek, -7 * (weeks - 1));
  const sessions = await WorkoutSession.find({ userId, status: "COMPLETED", completedAt: instantRange(first, addDays(thisWeek, 6)) }).lean();
  const out = new Map<string, TrainingWeekDTO>();
  for (let i = 0; i < weeks; i++) {
    const ws = addDays(first, 7 * i);
    out.set(ws, { weekStart: ws, sessions: 0, workingSets: 0, volumeKg: 0, durationMinutes: 0 });
  }
  for (const s of sessions) {
    const w = out.get(weekStart(localDateInZone(s.completedAt!, tz)));
    if (!w) continue;
    w.sessions += 1;
    w.workingSets += s.summary?.workingSets ?? 0;
    w.volumeKg = round(w.volumeKg + (s.summary?.volumeKg ?? 0), 0);
    w.durationMinutes += Math.round((s.summary?.durationSeconds ?? 0) / 60);
  }
  return [...out.values()];
}

// ---- Weekly report ------------------------------------------------------

export async function weeklyReport(userId: string, anyDateInWeek?: string): Promise<WeeklyReportDTO> {
  const tz = await timezoneOf(userId);
  const ws = weekStart(anyDateInWeek ?? localDateInZone(new Date(), tz));
  const we = addDays(ws, 6);
  const prevWs = addDays(ws, -7);

  const [foodDays, target, goal, sessions, measurements, assignment] = await Promise.all([
    FoodLog.aggregate<{ _id: string; entries: number; calories: number; protein: number; carbohydrates: number; fat: number; fibre: number }>([
      { $match: { userId: toObjectId(userId), localDate: { $gte: ws, $lte: we } } },
      {
        $group: {
          _id: "$localDate",
          entries: { $sum: 1 },
          calories: { $sum: "$nutritionSnapshot.calories" },
          protein: { $sum: "$nutritionSnapshot.protein" },
          carbohydrates: { $sum: "$nutritionSnapshot.carbohydrates" },
          fat: { $sum: "$nutritionSnapshot.fat" },
          fibre: { $sum: "$nutritionSnapshot.fibre" },
        },
      },
    ]),
    currentTarget(userId),
    UserGoal.findOne({ userId, status: "ACTIVE" }).lean(),
    WorkoutSession.find({ userId, status: "COMPLETED", completedAt: instantRange(ws, we) }).lean(),
    BodyMeasurement.find({ userId, recordedAt: instantRange(prevWs, we) }).sort({ recordedAt: 1 }).lean(),
    UserWorkoutAssignment.findOne({ userId, status: "ACTIVE" }).lean(),
  ]);

  // Nutrition: averages over logged days only — unlogged days are not zero intake.
  const n = foodDays.length;
  const avg = (k: "calories" | "protein" | "carbohydrates" | "fat" | "fibre") => (n ? round(foodDays.reduce((a, d) => a + d[k], 0) / n, 0) : null);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(ws, i);
    const d = foodDays.find((f) => f._id === date);
    return { date, entries: d?.entries ?? 0, calories: round(d?.calories ?? 0, 0), protein: round(d?.protein ?? 0, 0) };
  });

  // Training
  const weekSessions = sessions.filter((s) => {
    const d = localDateInZone(s.completedAt!, tz);
    return d >= ws && d <= we;
  });
  const sessionIds = weekSessions.map((s) => s._id);
  const discomfortReports = sessionIds.length ? await ExerciseLog.countDocuments({ userId, workoutSessionId: { $in: sessionIds }, "discomfort.reported": true }) : 0;
  const plan = assignment ? await WorkoutPlan.findById(assignment.workoutPlanId).select({ daysPerWeek: 1 }).lean() : null;
  const prs = weekSessions.flatMap((s) => (s.summary?.personalRecords ?? []).map((p) => ({ exerciseName: p.exerciseName, kind: p.kind, value: p.value })));

  // Body: weekly average weights (this week vs previous) and waist change.
  const local = measurements.map((m) => ({ date: localDateInZone(m.recordedAt, tz), m: m.measurements }));
  const weightsIn = (from: string, to: string) => local.filter((r) => r.date >= from && r.date <= to && typeof r.m.weightKg === "number").map((r) => r.m.weightKg as number);
  const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null);
  const thisW = weightsIn(ws, we);
  const prevW = weightsIn(prevWs, addDays(ws, -1));
  const waists = local.filter((r) => typeof r.m.waistCm === "number" && r.date <= we);
  const latestWaist = waists.filter((r) => r.date >= ws).at(-1)?.m.waistCm ?? null;
  const prevWaist = waists.filter((r) => r.date < ws).at(-1)?.m.waistCm ?? null;
  const avgW = mean(thisW);
  const prevAvgW = mean(prevW);

  const report: WeeklyReportDTO = {
    weekStart: ws,
    weekEnd: we,
    goalType: goal?.goalType ?? null,
    nutrition: {
      daysLogged: n,
      avgCalories: avg("calories"),
      avgProtein: avg("protein"),
      avgCarbohydrates: avg("carbohydrates"),
      avgFat: avg("fat"),
      avgFibre: avg("fibre"),
      target: target ? { calories: target.calories, protein: target.protein } : null,
      days,
    },
    training: {
      sessions: weekSessions.length,
      plannedPerWeek: plan?.daysPerWeek ?? null,
      workingSets: weekSessions.reduce((a, s) => a + (s.summary?.workingSets ?? 0), 0),
      volumeKg: round(weekSessions.reduce((a, s) => a + (s.summary?.volumeKg ?? 0), 0), 0),
      durationMinutes: weekSessions.reduce((a, s) => a + Math.round((s.summary?.durationSeconds ?? 0) / 60), 0),
      personalRecords: prs,
      discomfortReports,
    },
    body: {
      weighIns: thisW.length,
      avgWeightKg: avgW,
      prevAvgWeightKg: prevAvgW,
      changeKg: avgW !== null && prevAvgW !== null ? round(avgW - prevAvgW, 2) : null,
      latestWaistCm: latestWaist,
      waistChangeCm: latestWaist !== null && prevWaist !== null ? round(latestWaist - prevWaist, 1) : null,
    },
    recommendations: [],
  };
  report.recommendations = weeklyRecommendations({
    goalType: report.goalType,
    nutrition: { daysLogged: n, avgCalories: report.nutrition.avgCalories, avgProtein: report.nutrition.avgProtein, targetCalories: target?.calories ?? null, targetProtein: target?.protein ?? null },
    training: { sessions: report.training.sessions, plannedPerWeek: report.training.plannedPerWeek, personalRecords: prs.length, discomfortReports },
    body: { weighIns: thisW.length, avgWeightKg: avgW, prevAvgWeightKg: prevAvgW, waistChangeCm: report.body.waistChangeCm },
  });
  return report;
}
