import {
  activeDurationSeconds,
  localDateInZone,
  summarizeSets,
  weekdayInZone,
  type CurrentPlanDTO,
  type ExerciseLogDTO,
  type TodayWorkoutDTO,
  type UpdateExerciseLogInput,
  type WorkoutSessionDTO,
} from "@recomptrack/shared";
import type { Types } from "mongoose";
import { HttpError } from "../../utils/httpError";
import { paginate, paginated } from "../../utils/pagination";
import { idOf, toObjectId } from "../../utils/serialize";
import { Exercise } from "../exercises/exercise.model";
import { UserPreference } from "../users/userPreference.model";
import { getPlanDTO, toAssignmentDTOs, toDayDTOs } from "./plans.service";
import {
  ExerciseLog,
  UserWorkoutAssignment,
  WorkoutPlanDay,
  WorkoutSession,
  type IExerciseLog,
  type IWorkoutSession,
} from "./workout.models";

/** Every function takes the authenticated user id and filters by it. */

const OPEN = ["IN_PROGRESS", "PAUSED"] as const;

async function timezoneOf(userId: string) {
  return (await UserPreference.findOne({ userId }).select({ timezone: 1 }).lean())?.timezone ?? "UTC";
}

const activeAssignment = (userId: string) => UserWorkoutAssignment.findOne({ userId, status: "ACTIVE" }).sort({ createdAt: -1 }).lean();

export async function currentPlan(userId: string): Promise<CurrentPlanDTO | null> {
  const a = await activeAssignment(userId);
  if (!a) return null;
  const [assignment] = await toAssignmentDTOs([a]);
  return { assignment: assignment!, plan: await getPlanDTO(idOf(a.workoutPlanId)) };
}

/**
 * Which day to train today. Plans with weekdays follow the calendar (in the user's time zone);
 * plans without weekdays rotate: the day after the last completed one.
 */
export async function today(userId: string): Promise<TodayWorkoutDTO> {
  const [a, tz, open] = await Promise.all([
    activeAssignment(userId),
    timezoneOf(userId),
    WorkoutSession.findOne({ userId, status: { $in: OPEN } }).select({ _id: 1 }).lean(),
  ]);
  const activeSessionId = open ? idOf(open._id) : null;
  if (!a) return { assignmentId: null, day: null, reason: "NO_PLAN", startsOn: null, activeSessionId };

  const now = new Date();
  const todayLocal = localDateInZone(now, tz);
  const startsOn = a.startDate.toISOString().slice(0, 10);
  const base = { assignmentId: idOf(a._id), startsOn, activeSessionId };
  if (todayLocal < startsOn) return { ...base, day: null, reason: "NOT_STARTED" };

  const days = await toDayDTOs(await WorkoutPlanDay.find({ workoutPlanId: a.workoutPlanId }).lean());
  if (days.length === 0) return { ...base, day: null, reason: "REST_DAY" };

  const last = await WorkoutSession.findOne({ userId, assignmentId: a._id, status: "COMPLETED" }).sort({ completedAt: -1 }).lean();
  const doneToday = !!last?.completedAt && localDateInZone(last.completedAt, tz) === todayLocal;

  if (days.every((d) => d.weekday !== null)) {
    const day = days.find((d) => d.weekday === weekdayInZone(now, tz)) ?? null;
    if (!day) return { ...base, day: null, reason: "REST_DAY" };
    const done = doneToday && last && idOf(last.workoutPlanDayId) === day.id;
    return { ...base, day, reason: done ? "DONE_TODAY" : "SCHEDULED" };
  }

  const lastIndex = last ? days.findIndex((d) => d.id === idOf(last.workoutPlanDayId)) : -1;
  if (doneToday && lastIndex >= 0) return { ...base, day: days[lastIndex]!, reason: "DONE_TODAY" };
  return { ...base, day: days[(lastIndex + 1) % days.length]!, reason: "ROTATION" };
}

// ---- Serialisation -------------------------------------------------------

async function previousPerformance(userId: string, exerciseIds: string[], excludeSessionId: Types.ObjectId) {
  const map = new Map<string, { weightKg: number | null; reps: number | null }[]>();
  await Promise.all(
    exerciseIds.map(async (exerciseId) => {
      const prev = await ExerciseLog.findOne({
        userId,
        exerciseId,
        workoutSessionId: { $ne: excludeSessionId },
        "sets.completed": true,
      })
        .sort({ createdAt: -1 })
        .select({ sets: 1 })
        .lean();
      if (prev) map.set(exerciseId, prev.sets.filter((s) => s.completed).map((s) => ({ weightKg: s.weightKg, reps: s.reps })));
    }),
  );
  return map;
}

function toLogDTO(l: IExerciseLog, previous: ExerciseLogDTO["previous"]): ExerciseLogDTO {
  return {
    id: idOf(l._id),
    exerciseId: idOf(l.exerciseId),
    exerciseName: l.exerciseNameSnapshot,
    order: l.order,
    planned: l.planned
      ? { sets: l.planned.sets, repMin: l.planned.repMin, repMax: l.planned.repMax, restSeconds: l.planned.restSeconds }
      : null,
    previous,
    sets: l.sets.map((s) => ({ setNumber: s.setNumber, weightKg: s.weightKg, reps: s.reps, setType: s.setType, completed: s.completed, rpe: s.rpe })),
    notes: l.notes,
    discomfort: {
      reported: l.discomfort?.reported ?? false,
      location: l.discomfort?.location ?? null,
      severity: l.discomfort?.severity ?? null,
      notes: l.discomfort?.notes ?? null,
    },
  };
}

function toSessionDTO(s: IWorkoutSession): WorkoutSessionDTO {
  return {
    id: idOf(s._id),
    title: s.title,
    workoutPlanId: s.workoutPlanId ? idOf(s.workoutPlanId) : null,
    workoutPlanDayId: s.workoutPlanDayId ? idOf(s.workoutPlanDayId) : null,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    pausedAt: s.pausedAt?.toISOString() ?? null,
    pausedSeconds: s.pausedSeconds,
    status: s.status,
    notes: s.notes,
    summary: s.summary
      ? { ...s.summary, personalRecords: s.summary.personalRecords.map((p) => ({ ...p, exerciseId: idOf(p.exerciseId) })) }
      : null,
  };
}

async function ownedSession(userId: string, id: string) {
  const s = await WorkoutSession.findOne({ _id: id, userId });
  if (!s || s.status === "DISCARDED") throw HttpError.notFound("Workout");
  return s;
}

async function ownedOpenSession(userId: string, id: string) {
  const s = await ownedSession(userId, id);
  if (!OPEN.includes(s.status as (typeof OPEN)[number])) {
    throw HttpError.conflict("This workout is finished and can no longer be changed", "SESSION_CLOSED");
  }
  return s;
}

export async function getSession(userId: string, id: string): Promise<WorkoutSessionDTO> {
  const s = await ownedSession(userId, id);
  const logs = await ExerciseLog.find({ workoutSessionId: s._id, userId }).sort({ order: 1 }).lean();
  const prev = s.status === "COMPLETED" ? new Map() : await previousPerformance(userId, logs.map((l) => idOf(l.exerciseId)), s._id);
  return { ...toSessionDTO(s.toObject()), exercises: logs.map((l) => toLogDTO(l, prev.get(idOf(l.exerciseId)) ?? null)) };
}

export async function activeSession(userId: string) {
  const s = await WorkoutSession.findOne({ userId, status: { $in: OPEN } }).select({ _id: 1 }).lean();
  return s ? getSession(userId, idOf(s._id)) : null;
}

export async function history(userId: string, page: number, limit: number, exerciseId?: string) {
  const filter: Record<string, unknown> = { userId, status: "COMPLETED" };
  if (exerciseId) {
    const sessionIds = await ExerciseLog.distinct("workoutSessionId", { userId, exerciseId });
    filter._id = { $in: sessionIds };
  }
  const { skip } = paginate(page, limit);
  const [rows, total] = await Promise.all([
    WorkoutSession.find(filter).sort({ completedAt: -1 }).skip(skip).limit(limit).lean(),
    WorkoutSession.countDocuments(filter),
  ]);
  return paginated(rows.map(toSessionDTO), total, page, limit);
}

// ---- Lifecycle -----------------------------------------------------------

/** Heaviest completed working weight the user last used for each exercise — used to prefill sets. */
async function lastWorkingWeights(userId: string, exerciseIds: string[]) {
  const map = new Map<string, number | null>();
  const prev = await previousPerformance(userId, exerciseIds, toObjectId("000000000000000000000000"));
  for (const id of exerciseIds) {
    const sets = prev.get(id);
    map.set(id, sets?.length ? Math.max(...sets.map((s) => s.weightKg ?? 0)) || null : null);
  }
  return map;
}

export async function startSession(userId: string, input: { workoutPlanDayId?: string }) {
  if (await WorkoutSession.exists({ userId, status: { $in: OPEN } })) {
    throw HttpError.conflict("Finish or discard your current workout first", "SESSION_IN_PROGRESS");
  }
  let assignmentId: Types.ObjectId | null = null;
  let day = null;
  if (input.workoutPlanDayId) {
    // The day must belong to the plan currently assigned to *this* user.
    const a = await activeAssignment(userId);
    day = a ? await WorkoutPlanDay.findOne({ _id: input.workoutPlanDayId, workoutPlanId: a.workoutPlanId }).lean() : null;
    if (!a || !day) throw HttpError.notFound("Workout day");
    assignmentId = a._id;
  }

  let session;
  try {
    session = await WorkoutSession.create({
      userId,
      assignmentId,
      workoutPlanId: day?.workoutPlanId ?? null,
      workoutPlanDayId: day?._id ?? null,
      title: day?.dayName ?? "Free workout",
      startedAt: new Date(),
      status: "IN_PROGRESS",
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw HttpError.conflict("Finish or discard your current workout first", "SESSION_IN_PROGRESS");
    throw err;
  }

  if (day) {
    const planned = [...day.exercises].sort((a, b) => a.order - b.order);
    const weights = await lastWorkingWeights(userId, planned.map((e) => idOf(e.exerciseId)));
    await ExerciseLog.insertMany(
      planned.map((e, i) => ({
        workoutSessionId: session._id,
        userId,
        exerciseId: e.exerciseId,
        exerciseNameSnapshot: e.exerciseNameSnapshot,
        order: i + 1,
        planned: { sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSeconds: e.restSeconds },
        sets: Array.from({ length: e.sets }, (_, n) => ({
          setNumber: n + 1,
          weightKg: weights.get(idOf(e.exerciseId)) ?? null,
          reps: null,
          setType: "WORKING",
          completed: false,
        })),
      })),
    );
  }
  return getSession(userId, idOf(session._id));
}

export async function addExercise(userId: string, sessionId: string, exerciseId: string) {
  const s = await ownedOpenSession(userId, sessionId);
  const exercise = await Exercise.findOne({ _id: exerciseId, status: "ACTIVE" }).lean();
  if (!exercise) throw HttpError.notFound("Exercise");
  const last = await ExerciseLog.findOne({ workoutSessionId: s._id }).sort({ order: -1 }).select({ order: 1 }).lean();
  const weight = (await lastWorkingWeights(userId, [exerciseId])).get(exerciseId) ?? null;
  await ExerciseLog.create({
    workoutSessionId: s._id,
    userId,
    exerciseId: exercise._id,
    exerciseNameSnapshot: exercise.name,
    order: (last?.order ?? 0) + 1,
    planned: null,
    sets: Array.from({ length: exercise.defaultSets }, (_, n) => ({ setNumber: n + 1, weightKg: weight, reps: null, setType: "WORKING", completed: false })),
  });
  return getSession(userId, sessionId);
}

export async function updateExerciseLog(userId: string, sessionId: string, logId: string, input: UpdateExerciseLogInput) {
  const s = await ownedOpenSession(userId, sessionId);
  const log = await ExerciseLog.findOne({ _id: logId, workoutSessionId: s._id, userId });
  if (!log) throw HttpError.notFound("Exercise");
  if (input.sets) {
    log.set(
      "sets",
      input.sets.map((set, i) => ({ ...set, setNumber: i + 1 })),
    );
  }
  if (input.notes !== undefined) log.notes = input.notes ?? null;
  if (input.discomfort) {
    log.discomfort = {
      reported: input.discomfort.reported,
      location: input.discomfort.location ?? null,
      severity: input.discomfort.severity ?? null,
      notes: input.discomfort.notes ?? null,
    };
  }
  await log.save();
  const prev = await previousPerformance(userId, [idOf(log.exerciseId)], s._id);
  return toLogDTO(log.toObject(), prev.get(idOf(log.exerciseId)) ?? null);
}

export async function removeExercise(userId: string, sessionId: string, logId: string) {
  const s = await ownedOpenSession(userId, sessionId);
  const r = await ExerciseLog.deleteOne({ _id: logId, workoutSessionId: s._id, userId });
  if (r.deletedCount === 0) throw HttpError.notFound("Exercise");
  return getSession(userId, sessionId);
}

export async function setNotes(userId: string, sessionId: string, notes: string | null) {
  const s = await ownedSession(userId, sessionId);
  s.notes = notes;
  await s.save();
  return getSession(userId, sessionId);
}

export async function pause(userId: string, sessionId: string) {
  const s = await ownedOpenSession(userId, sessionId);
  if (s.status === "IN_PROGRESS") {
    s.status = "PAUSED";
    s.pausedAt = new Date();
    await s.save();
  }
  return getSession(userId, sessionId);
}

function closePause(s: IWorkoutSession & { pausedAt: Date | null }, now: Date) {
  if (s.pausedAt) {
    s.pausedSeconds += Math.round((now.getTime() - s.pausedAt.getTime()) / 1000);
    s.pausedAt = null;
  }
}

export async function resume(userId: string, sessionId: string) {
  const s = await ownedOpenSession(userId, sessionId);
  if (s.status === "PAUSED") {
    closePause(s, new Date());
    s.status = "IN_PROGRESS";
    await s.save();
  }
  return getSession(userId, sessionId);
}

export async function discard(userId: string, sessionId: string) {
  const s = await ownedOpenSession(userId, sessionId);
  await ExerciseLog.deleteMany({ workoutSessionId: s._id, userId });
  s.status = "DISCARDED";
  s.completedAt = new Date();
  await s.save();
}

/** Finish the workout: freeze it, compute the summary and personal records. */
export async function complete(userId: string, sessionId: string) {
  const s = await ownedOpenSession(userId, sessionId);
  const logs = await ExerciseLog.find({ workoutSessionId: s._id, userId }).lean();
  const perExercise = logs.map((l) => ({ log: l, stats: summarizeSets(l.sets) }));
  if (!perExercise.some((p) => p.stats.workingSets > 0)) {
    throw HttpError.validation([{ path: "sets", message: "Complete at least one set, or discard this workout" }]);
  }

  // Previous bests come from this user's other logs for the same exercises.
  const exerciseIds = [...new Set(logs.map((l) => idOf(l.exerciseId)))];
  const previousLogs = await ExerciseLog.find({ userId, exerciseId: { $in: exerciseIds }, workoutSessionId: { $ne: s._id } })
    .select({ exerciseId: 1, sets: 1 })
    .lean();
  const previousBest = new Map<string, { oneRm: number; heaviest: number }>();
  for (const l of previousLogs) {
    const st = summarizeSets(l.sets);
    if (st.workingSets === 0) continue;
    const k = idOf(l.exerciseId);
    const cur = previousBest.get(k) ?? { oneRm: 0, heaviest: 0 };
    previousBest.set(k, { oneRm: Math.max(cur.oneRm, st.bestOneRepMax), heaviest: Math.max(cur.heaviest, st.heaviestKg) });
  }

  const personalRecords: NonNullable<IWorkoutSession["summary"]>["personalRecords"] = [];
  const bestThisSession = new Map<string, { oneRm: number; heaviest: number; name: string; id: Types.ObjectId }>();
  for (const { log, stats } of perExercise) {
    const k = idOf(log.exerciseId);
    const cur = bestThisSession.get(k) ?? { oneRm: 0, heaviest: 0, name: log.exerciseNameSnapshot, id: log.exerciseId };
    bestThisSession.set(k, { ...cur, oneRm: Math.max(cur.oneRm, stats.bestOneRepMax), heaviest: Math.max(cur.heaviest, stats.heaviestKg) });
  }
  for (const [k, best] of bestThisSession) {
    const prev = previousBest.get(k);
    if (!prev) continue; // first time doing an exercise is a baseline, not a record
    if (best.heaviest > prev.heaviest) {
      personalRecords.push({ exerciseId: best.id, exerciseName: best.name, kind: "HEAVIEST_WEIGHT", value: best.heaviest, previous: prev.heaviest });
    }
    if (best.oneRm > prev.oneRm) {
      personalRecords.push({ exerciseId: best.id, exerciseName: best.name, kind: "ESTIMATED_1RM", value: best.oneRm, previous: prev.oneRm });
    }
  }

  const now = new Date();
  closePause(s, now);
  s.status = "COMPLETED";
  s.completedAt = now;
  const durationSeconds = activeDurationSeconds(s.startedAt, now, s.pausedSeconds);
  s.durationSeconds = durationSeconds;
  s.summary = {
    durationSeconds,
    exercises: perExercise.filter((p) => p.stats.workingSets > 0).length,
    workingSets: perExercise.reduce((a, p) => a + p.stats.workingSets, 0),
    reps: perExercise.reduce((a, p) => a + p.stats.reps, 0),
    volumeKg: Math.round(perExercise.reduce((a, p) => a + p.stats.volumeKg, 0) * 10) / 10,
    personalRecords,
  };
  await s.save();
  return getSession(userId, sessionId);
}
