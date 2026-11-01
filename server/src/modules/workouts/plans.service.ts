import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { AssignmentDTO, PlanDayDTO, SavePlanInput, WorkoutPlanDTO, WorkoutPlanSummaryDTO } from "@recomptrack/shared";
import { HttpError } from "../../utils/httpError";
import { paginate, paginated } from "../../utils/pagination";
import { idOf, toObjectId } from "../../utils/serialize";
import { containsRegex } from "../../utils/text";
import { recordAudit } from "../audit/audit.service";
import { Exercise } from "../exercises/exercise.model";
import { EquipmentType, MuscleGroup } from "../exercises/lookup.models";
import { User } from "../users/user.model";
import {
  UserWorkoutAssignment,
  WorkoutPlan,
  WorkoutPlanDay,
  type IUserWorkoutAssignment,
  type IWorkoutPlan,
  type IWorkoutPlanDay,
} from "./workout.models";

type ParsedPlan = {
  name: string;
  description?: string | null;
  goalType: IWorkoutPlan["goalType"];
  experienceLevel: IWorkoutPlan["experienceLevel"];
  durationWeeks: number;
  warmUpInstructions?: string | null;
  days: { weekday: number | null; dayName: string; exercises: { exerciseId: string; sets: number; repMin: number; repMax: number; restSeconds: number; notes?: string | null }[] }[];
};

export function toPlanSummary(p: IWorkoutPlan, activeAssignments?: number): WorkoutPlanSummaryDTO {
  return {
    id: idOf(p._id),
    planKey: p.planKey,
    version: p.version,
    isLatest: p.isLatest,
    name: p.name,
    description: p.description,
    goalType: p.goalType,
    experienceLevel: p.experienceLevel,
    durationWeeks: p.durationWeeks,
    daysPerWeek: p.daysPerWeek,
    status: p.status,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    ...(activeAssignments !== undefined ? { activeAssignments } : {}),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function toDayDTOs(days: IWorkoutPlanDay[]): Promise<PlanDayDTO[]> {
  const exerciseIds = [...new Set(days.flatMap((d) => d.exercises.map((e) => idOf(e.exerciseId))))];
  const exercises = await Exercise.find({ _id: { $in: exerciseIds } }).select({ name: 1, primaryMuscleId: 1, equipmentId: 1 }).lean();
  const [muscles, equipment] = await Promise.all([
    MuscleGroup.find({ _id: { $in: exercises.map((e) => e.primaryMuscleId) } }).lean(),
    EquipmentType.find({ _id: { $in: exercises.map((e) => e.equipmentId).filter(Boolean) } }).lean(),
  ]);
  const exMap = new Map(exercises.map((e) => [idOf(e._id), e]));
  const mMap = new Map(muscles.map((m) => [idOf(m._id), m.name]));
  const eqMap = new Map(equipment.map((m) => [idOf(m._id), m.name]));
  return [...days]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => ({
      id: idOf(d._id),
      dayNumber: d.dayNumber,
      weekday: d.weekday,
      dayName: d.dayName,
      exercises: [...d.exercises]
        .sort((a, b) => a.order - b.order)
        .map((e) => {
          const ex = exMap.get(idOf(e.exerciseId));
          return {
            exerciseId: idOf(e.exerciseId),
            // The live name if the exercise still exists, otherwise the snapshot taken when the plan was saved.
            exerciseName: ex?.name ?? e.exerciseNameSnapshot,
            primaryMuscle: ex ? (mMap.get(idOf(ex.primaryMuscleId)) ?? null) : null,
            equipment: ex?.equipmentId ? (eqMap.get(idOf(ex.equipmentId)) ?? null) : null,
            order: e.order,
            sets: e.sets,
            repMin: e.repMin,
            repMax: e.repMax,
            restSeconds: e.restSeconds,
            notes: e.notes,
          };
        }),
    }));
}

export async function getPlanDTO(id: string): Promise<WorkoutPlanDTO> {
  const plan = await WorkoutPlan.findById(id).lean();
  if (!plan) throw HttpError.notFound("Workout plan");
  const [days, versions, activeAssignments] = await Promise.all([
    WorkoutPlanDay.find({ workoutPlanId: plan._id }).lean(),
    WorkoutPlan.find({ planKey: plan.planKey }).sort({ version: -1 }).select({ version: 1, status: 1, publishedAt: 1 }).lean(),
    UserWorkoutAssignment.countDocuments({ workoutPlanId: plan._id, status: "ACTIVE" }),
  ]);
  return {
    ...toPlanSummary(plan, activeAssignments),
    warmUpInstructions: plan.warmUpInstructions,
    days: await toDayDTOs(days),
    versions: versions.map((v) => ({ id: idOf(v._id), version: v.version, status: v.status, publishedAt: v.publishedAt?.toISOString() ?? null })),
  };
}

export async function listPlans(query: { q?: string; status?: string; latestOnly: "true" | "false"; page: number; limit: number }) {
  const filter: Record<string, unknown> = {};
  if (query.latestOnly === "true") filter.isLatest = true;
  if (query.status && query.status !== "ALL") filter.status = query.status;
  if (query.q) filter.name = containsRegex(query.q);
  const { skip, limit } = paginate(query.page, query.limit);
  const [items, total] = await Promise.all([
    WorkoutPlan.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    WorkoutPlan.countDocuments(filter),
  ]);
  const counts = await UserWorkoutAssignment.aggregate<{ _id: unknown; n: number }>([
    { $match: { status: "ACTIVE", workoutPlanId: { $in: items.map((p) => p._id) } } },
    { $group: { _id: "$workoutPlanId", n: { $sum: 1 } } },
  ]);
  const byPlan = new Map(counts.map((c) => [idOf(c._id), c.n]));
  return paginated(items.map((p) => toPlanSummary(p, byPlan.get(idOf(p._id)) ?? 0)), total, query.page, query.limit);
}

/** Every exercise referenced must exist; new or changed plans may only use active exercises. */
async function buildDays(planId: unknown, days: ParsedPlan["days"]) {
  const ids = [...new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))];
  const found = await Exercise.find({ _id: { $in: ids }, status: "ACTIVE" }).select({ name: 1 }).lean();
  const names = new Map(found.map((e) => [idOf(e._id), e.name]));
  const missing = ids.filter((id) => !names.has(id));
  if (missing.length) {
    throw HttpError.validation([{ path: "days", message: `${missing.length} exercise(s) are archived or no longer exist` }]);
  }
  return days.map((d, i) => ({
    workoutPlanId: planId,
    dayNumber: i + 1,
    weekday: d.weekday,
    dayName: d.dayName,
    exercises: d.exercises.map((e, j) => ({
      exerciseId: toObjectId(e.exerciseId),
      exerciseNameSnapshot: names.get(e.exerciseId)!,
      order: j + 1,
      sets: e.sets,
      repMin: e.repMin,
      repMax: e.repMax,
      restSeconds: e.restSeconds,
      notes: e.notes ?? null,
    })),
  }));
}

function planFields(input: ParsedPlan) {
  return {
    name: input.name,
    description: input.description ?? null,
    goalType: input.goalType,
    experienceLevel: input.experienceLevel,
    durationWeeks: input.durationWeeks,
    daysPerWeek: input.days.length,
    warmUpInstructions: input.warmUpInstructions ?? null,
  };
}

export async function createPlan(req: Request, input: ParsedPlan) {
  const plan = new WorkoutPlan({
    ...planFields(input),
    planKey: randomUUID(),
    version: 1,
    isLatest: true,
    status: "DRAFT",
    createdBy: req.auth!.userId,
  });
  const days = await buildDays(plan._id, input.days);
  await plan.save();
  await WorkoutPlanDay.insertMany(days);
  await recordAudit(req, { action: "WORKOUT_PLAN_CREATED", entityType: "WORKOUT_PLAN", entityId: idOf(plan._id), summary: `Created plan ${plan.name} (draft v1)` });
  return getPlanDTO(idOf(plan._id));
}

/** Only drafts are editable. Published versions are frozen; edit them through `revise`. */
export async function updateDraft(req: Request, id: string, input: ParsedPlan) {
  const plan = await WorkoutPlan.findById(id);
  if (!plan) throw HttpError.notFound("Workout plan");
  if (plan.status !== "DRAFT") {
    throw HttpError.conflict("Published plans cannot be edited. Create a new version instead.", "PLAN_NOT_EDITABLE");
  }
  const days = await buildDays(plan._id, input.days);
  plan.set(planFields(input));
  await plan.save();
  await WorkoutPlanDay.deleteMany({ workoutPlanId: plan._id });
  await WorkoutPlanDay.insertMany(days);
  await recordAudit(req, { action: "WORKOUT_PLAN_UPDATED", entityType: "WORKOUT_PLAN", entityId: id, summary: `Edited draft ${plan.name} v${plan.version}` });
  return getPlanDTO(id);
}

export async function publishPlan(req: Request, id: string) {
  const plan = await WorkoutPlan.findById(id);
  if (!plan) throw HttpError.notFound("Workout plan");
  if (plan.status !== "DRAFT") throw HttpError.conflict("Only drafts can be published", "PLAN_NOT_DRAFT");
  const days = await WorkoutPlanDay.find({ workoutPlanId: plan._id }).lean();
  const empty = days.filter((d) => d.exercises.length === 0);
  if (days.length === 0 || empty.length) {
    throw HttpError.validation([{ path: "days", message: "Every training day needs at least one exercise" }]);
  }
  const ids = [...new Set(days.flatMap((d) => d.exercises.map((e) => idOf(e.exerciseId))))];
  if ((await Exercise.countDocuments({ _id: { $in: ids }, status: "ACTIVE" })) !== ids.length) {
    throw HttpError.validation([{ path: "days", message: "The plan uses an archived exercise — replace it before publishing" }]);
  }
  // Older published versions stop accepting new assignments; users on them keep their version.
  const superseded = await WorkoutPlan.updateMany(
    { planKey: plan.planKey, status: "PUBLISHED", _id: { $ne: plan._id } },
    { $set: { status: "ARCHIVED" } },
  );
  plan.status = "PUBLISHED";
  plan.publishedAt = new Date();
  await plan.save();
  await recordAudit(req, {
    action: "WORKOUT_PLAN_PUBLISHED",
    entityType: "WORKOUT_PLAN",
    entityId: id,
    summary: `Published ${plan.name} v${plan.version}${superseded.modifiedCount ? " (previous version archived)" : ""}`,
  });
  return getPlanDTO(id);
}

async function copyPlan(req: Request, source: IWorkoutPlan, target: { planKey: string; version: number; name: string }) {
  const days = await WorkoutPlanDay.find({ workoutPlanId: source._id }).lean();
  const plan = await WorkoutPlan.create({
    planKey: target.planKey,
    version: target.version,
    isLatest: true,
    name: target.name,
    description: source.description,
    goalType: source.goalType,
    experienceLevel: source.experienceLevel,
    durationWeeks: source.durationWeeks,
    daysPerWeek: source.daysPerWeek,
    warmUpInstructions: source.warmUpInstructions,
    status: "DRAFT",
    createdBy: req.auth!.userId,
  });
  await WorkoutPlanDay.insertMany(
    days.map((d) => ({ workoutPlanId: plan._id, dayNumber: d.dayNumber, weekday: d.weekday, dayName: d.dayName, exercises: d.exercises })),
  );
  return plan;
}

/** Start the next version of a published plan as a draft. */
export async function revisePlan(req: Request, id: string) {
  const source = await WorkoutPlan.findById(id).lean();
  if (!source) throw HttpError.notFound("Workout plan");
  if (source.status === "DRAFT") throw HttpError.conflict("This version is still a draft — edit it directly", "PLAN_IS_DRAFT");
  const existingDraft = await WorkoutPlan.findOne({ planKey: source.planKey, status: "DRAFT" }).select({ _id: 1 }).lean();
  if (existingDraft) throw HttpError.conflict("A draft of the next version already exists", "DRAFT_EXISTS");
  const latest = await WorkoutPlan.findOne({ planKey: source.planKey }).sort({ version: -1 }).lean();
  await WorkoutPlan.updateMany({ planKey: source.planKey }, { $set: { isLatest: false } });
  const draft = await copyPlan(req, source, { planKey: source.planKey, version: latest!.version + 1, name: source.name });
  await recordAudit(req, {
    action: "WORKOUT_PLAN_REVISED",
    entityType: "WORKOUT_PLAN",
    entityId: idOf(draft._id),
    summary: `Started ${source.name} v${draft.version} (draft) from v${source.version}`,
  });
  return getPlanDTO(idOf(draft._id));
}

export async function duplicatePlan(req: Request, id: string) {
  const source = await WorkoutPlan.findById(id).lean();
  if (!source) throw HttpError.notFound("Workout plan");
  const copy = await copyPlan(req, source, { planKey: randomUUID(), version: 1, name: `Copy of ${source.name}`.slice(0, 120) });
  await recordAudit(req, { action: "WORKOUT_PLAN_DUPLICATED", entityType: "WORKOUT_PLAN", entityId: idOf(copy._id), summary: `Duplicated ${source.name} as ${copy.name}` });
  return getPlanDTO(idOf(copy._id));
}

export async function archivePlan(req: Request, id: string) {
  const plan = await WorkoutPlan.findById(id);
  if (!plan) throw HttpError.notFound("Workout plan");
  if (plan.status !== "PUBLISHED") throw HttpError.conflict("Only published plans can be archived; delete drafts instead", "PLAN_NOT_PUBLISHED");
  plan.status = "ARCHIVED";
  await plan.save();
  await recordAudit(req, { action: "WORKOUT_PLAN_ARCHIVED", entityType: "WORKOUT_PLAN", entityId: id, summary: `Archived ${plan.name} v${plan.version}` });
  return getPlanDTO(id);
}

export async function deleteDraft(req: Request, id: string) {
  const plan = await WorkoutPlan.findById(id);
  if (!plan) throw HttpError.notFound("Workout plan");
  if (plan.status !== "DRAFT") throw HttpError.conflict("Only drafts can be deleted. Archive published plans.", "PLAN_NOT_DRAFT");
  await WorkoutPlanDay.deleteMany({ workoutPlanId: plan._id });
  await plan.deleteOne();
  // The previous version becomes the latest again.
  const previous = await WorkoutPlan.findOne({ planKey: plan.planKey }).sort({ version: -1 });
  if (previous) {
    previous.isLatest = true;
    await previous.save();
  }
  await recordAudit(req, { action: "WORKOUT_PLAN_DELETED", entityType: "WORKOUT_PLAN", entityId: id, summary: `Deleted draft ${plan.name} v${plan.version}` });
}

// ---- Assignments ---------------------------------------------------------

export async function toAssignmentDTOs(rows: IUserWorkoutAssignment[], opts: { withUser?: boolean } = {}): Promise<AssignmentDTO[]> {
  const plans = await WorkoutPlan.find({ _id: { $in: rows.map((r) => r.workoutPlanId) } }).select({ name: 1, planKey: 1 }).lean();
  const planMap = new Map(plans.map((p) => [idOf(p._id), p]));
  const latest = await WorkoutPlan.aggregate<{ _id: string; v: number }>([
    { $match: { planKey: { $in: plans.map((p) => p.planKey) }, status: "PUBLISHED" } },
    { $group: { _id: "$planKey", v: { $max: "$version" } } },
  ]);
  const latestMap = new Map(latest.map((l) => [l._id, l.v]));
  const users = opts.withUser ? await User.find({ _id: { $in: rows.map((r) => r.userId) } }).select({ name: 1, email: 1 }).lean() : [];
  const userMap = new Map(users.map((u) => [idOf(u._id), u]));
  return rows.map((r) => {
    const plan = planMap.get(idOf(r.workoutPlanId));
    const u = userMap.get(idOf(r.userId));
    return {
      id: idOf(r._id),
      userId: idOf(r.userId),
      ...(u ? { user: { id: idOf(u._id), name: u.name, email: u.email } } : {}),
      workoutPlanId: idOf(r.workoutPlanId),
      planName: plan?.name ?? "Deleted plan",
      planVersion: r.planVersion,
      latestPublishedVersion: plan ? (latestMap.get(plan.planKey) ?? null) : null,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate?.toISOString() ?? null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Assign a published plan version. Replaces the user's current assignment (history is kept). */
export async function assignPlan(req: Request, input: { userId: string; workoutPlanId: string; startDate: string }) {
  const [user, plan] = await Promise.all([User.findById(input.userId).lean(), WorkoutPlan.findById(input.workoutPlanId).lean()]);
  if (!user) throw HttpError.notFound("User");
  if (user.status !== "ACTIVE") throw HttpError.conflict("This account is deactivated", "USER_INACTIVE");
  if (!plan) throw HttpError.notFound("Workout plan");
  if (plan.status !== "PUBLISHED") throw HttpError.conflict("Only published plans can be assigned", "PLAN_NOT_PUBLISHED");

  const now = new Date();
  await UserWorkoutAssignment.updateMany(
    { userId: user._id, status: "ACTIVE" },
    { $set: { status: "CANCELLED", endDate: now } },
  );
  const assignment = await UserWorkoutAssignment.create({
    userId: user._id,
    workoutPlanId: plan._id,
    planVersion: plan.version,
    startDate: new Date(`${input.startDate}T00:00:00Z`),
    status: "ACTIVE",
    assignedBy: req.auth!.userId,
  });
  await recordAudit(req, {
    action: "WORKOUT_PLAN_ASSIGNED",
    entityType: "USER",
    entityId: input.userId,
    summary: `Assigned ${plan.name} v${plan.version} to ${user.email} from ${input.startDate}`,
  });
  return (await toAssignmentDTOs([assignment.toObject()], { withUser: true }))[0]!;
}

export async function endAssignment(req: Request, id: string) {
  const a = await UserWorkoutAssignment.findById(id);
  if (!a) throw HttpError.notFound("Assignment");
  if (a.status !== "ACTIVE") throw HttpError.conflict("This assignment has already ended", "ASSIGNMENT_ENDED");
  a.status = "CANCELLED";
  a.endDate = new Date();
  await a.save();
  await recordAudit(req, { action: "WORKOUT_ASSIGNMENT_ENDED", entityType: "USER", entityId: idOf(a.userId), summary: "Ended workout plan assignment" });
  return (await toAssignmentDTOs([a.toObject()], { withUser: true }))[0]!;
}

export type { ParsedPlan, SavePlanInput };
