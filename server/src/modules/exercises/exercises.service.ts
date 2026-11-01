import type { Request } from "express";
import type { CreateExerciseInput, ExerciseDTO, LookupDTO, UpdateExerciseInput } from "@recomptrack/shared";
import type { Types } from "mongoose";
import { diff } from "../../utils/diff";
import { HttpError } from "../../utils/httpError";
import { paginate, paginated } from "../../utils/pagination";
import { idOf, toObjectId } from "../../utils/serialize";
import { containsRegex } from "../../utils/text";
import { recordAudit } from "../audit/audit.service";
import { ExerciseLog, WorkoutPlanDay } from "../workouts/workout.models";
import { Exercise, type IExercise } from "./exercise.model";
import { EquipmentType, MuscleGroup, type ILookup } from "./lookup.models";

export function toLookupDTO(l: ILookup): LookupDTO {
  return { id: idOf(l._id), name: l.name, slug: l.slug, description: l.description, status: l.status };
}

/** Resolve lookup references for a page of exercises in two queries (no N+1). */
async function toDTOs(exercises: IExercise[]): Promise<ExerciseDTO[]> {
  const muscleIds = new Set<string>();
  const equipmentIds = new Set<string>();
  for (const e of exercises) {
    muscleIds.add(idOf(e.primaryMuscleId));
    e.secondaryMuscleIds.forEach((m) => muscleIds.add(idOf(m)));
    if (e.equipmentId) equipmentIds.add(idOf(e.equipmentId));
  }
  const [muscles, equipment] = await Promise.all([
    MuscleGroup.find({ _id: { $in: [...muscleIds] } }).lean(),
    EquipmentType.find({ _id: { $in: [...equipmentIds] } }).lean(),
  ]);
  const m = new Map(muscles.map((x) => [idOf(x._id), toLookupDTO(x)]));
  const eq = new Map(equipment.map((x) => [idOf(x._id), toLookupDTO(x)]));

  return exercises.map((e) => ({
    id: idOf(e._id),
    code: e.code,
    name: e.name,
    primaryMuscle: m.get(idOf(e.primaryMuscleId)) ?? null,
    secondaryMuscles: e.secondaryMuscleIds.map((id) => m.get(idOf(id))).filter((x): x is LookupDTO => !!x),
    equipment: e.equipmentId ? (eq.get(idOf(e.equipmentId)) ?? null) : null,
    exerciseType: e.exerciseType,
    movementPattern: e.movementPattern,
    instructions: e.instructions,
    mediaUrl: e.mediaUrl,
    defaultSets: e.defaultSets,
    defaultRepMin: e.defaultRepMin,
    defaultRepMax: e.defaultRepMax,
    defaultRestSeconds: e.defaultRestSeconds,
    notes: e.notes,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));
}

export async function toDTO(e: IExercise): Promise<ExerciseDTO> {
  return (await toDTOs([e]))[0]!;
}

export interface ExerciseListQuery {
  q?: string;
  status?: "ACTIVE" | "ARCHIVED" | "ALL";
  muscleId?: string;
  equipmentId?: string;
  exerciseType?: string;
  page: number;
  limit: number;
}

export async function listExercises(query: ExerciseListQuery, opts: { activeOnly: boolean }) {
  const filter: Record<string, unknown> = {};
  if (opts.activeOnly) filter.status = "ACTIVE";
  else if (query.status && query.status !== "ALL") filter.status = query.status;
  if (query.q) filter.$or = [{ name: containsRegex(query.q) }, { code: containsRegex(query.q) }];
  if (query.muscleId) {
    const id = toObjectId(query.muscleId);
    filter.$and = [{ $or: [{ primaryMuscleId: id }, { secondaryMuscleIds: id }] }];
  }
  if (query.equipmentId) filter.equipmentId = toObjectId(query.equipmentId);
  if (query.exerciseType) filter.exerciseType = query.exerciseType;

  const { skip, limit } = paginate(query.page, query.limit);
  const [items, total] = await Promise.all([
    Exercise.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Exercise.countDocuments(filter),
  ]);
  return paginated(await toDTOs(items), total, query.page, query.limit);
}

export async function getExercise(id: string, opts: { activeOnly: boolean }) {
  const exercise = await Exercise.findOne({ _id: id, ...(opts.activeOnly ? { status: "ACTIVE" } : {}) }).lean();
  if (!exercise) throw HttpError.notFound("Exercise");
  return toDTO(exercise);
}

/** The backend validates references itself — MongoDB has no foreign keys. */
async function assertLookupsExist(input: Partial<CreateExerciseInput>) {
  const muscleIds = [
    ...(input.primaryMuscleId ? [input.primaryMuscleId] : []),
    ...(input.secondaryMuscleIds ?? []),
  ];
  const unique = [...new Set(muscleIds)];
  if (unique.length > 0) {
    const found = await MuscleGroup.countDocuments({ _id: { $in: unique }, status: "ACTIVE" });
    if (found !== unique.length) {
      throw HttpError.validation([{ path: "primaryMuscleId", message: "Unknown or archived muscle group" }]);
    }
  }
  if (input.equipmentId) {
    if (!(await EquipmentType.exists({ _id: input.equipmentId, status: "ACTIVE" }))) {
      throw HttpError.validation([{ path: "equipmentId", message: "Unknown or archived equipment type" }]);
    }
  }
}

async function assertCodeFree(code: string, exceptId?: Types.ObjectId) {
  const clash = await Exercise.exists({ code, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (clash) throw HttpError.conflict(`Exercise code ${code} is already used`, "DUPLICATE_CODE");
}

function plain(e: IExercise) {
  return JSON.parse(JSON.stringify(e)) as Record<string, unknown>;
}

export async function createExercise(req: Request, input: CreateExerciseInput) {
  await assertLookupsExist(input);
  await assertCodeFree(input.code);
  const exercise = await Exercise.create({
    ...input,
    secondaryMuscleIds: [...new Set(input.secondaryMuscleIds ?? [])].filter((id) => id !== input.primaryMuscleId),
    createdBy: req.auth!.userId,
    updatedBy: req.auth!.userId,
  });
  await recordAudit(req, {
    action: "EXERCISE_CREATED",
    entityType: "EXERCISE",
    entityId: idOf(exercise._id),
    summary: `Created exercise ${exercise.code} ${exercise.name}`,
  });
  return toDTO(exercise.toObject());
}

export async function updateExercise(req: Request, id: string, input: UpdateExerciseInput) {
  const exercise = await Exercise.findById(id);
  if (!exercise) throw HttpError.notFound("Exercise");
  await assertLookupsExist(input);
  if (input.code && input.code !== exercise.code) await assertCodeFree(input.code, exercise._id);

  const merged = { ...exercise.toObject(), ...input };
  if ((merged.defaultRepMin ?? 0) > (merged.defaultRepMax ?? 0)) {
    throw HttpError.validation([{ path: "defaultRepMax", message: "Minimum reps cannot exceed maximum reps" }]);
  }

  const before = plain(exercise.toObject());
  exercise.set({ ...input, updatedBy: req.auth!.userId });
  if (exercise.secondaryMuscleIds) {
    const primary = idOf(exercise.primaryMuscleId);
    exercise.secondaryMuscleIds = exercise.secondaryMuscleIds.filter((m) => idOf(m) !== primary);
  }
  await exercise.save();
  // Changing defaults affects only plans built afterwards: plan days copy sets/reps when created,
  // and logged sessions keep their own records. Nothing historical is rewritten here.
  await recordAudit(req, {
    action: "EXERCISE_UPDATED",
    entityType: "EXERCISE",
    entityId: id,
    summary: `Updated exercise ${exercise.code}`,
    changes: diff(before, plain(exercise.toObject()), ["updatedAt", "createdAt", "__v", "_id", "updatedBy"]),
  });
  return toDTO(exercise.toObject());
}

export async function setExerciseStatus(req: Request, id: string, status: "ACTIVE" | "ARCHIVED") {
  const exercise = await Exercise.findById(id);
  if (!exercise) throw HttpError.notFound("Exercise");
  if (exercise.status !== status) {
    const from = exercise.status;
    exercise.status = status;
    exercise.archivedAt = status === "ARCHIVED" ? new Date() : null;
    exercise.updatedBy = toObjectId(req.auth!.userId);
    await exercise.save();
    await recordAudit(req, {
      action: status === "ARCHIVED" ? "EXERCISE_ARCHIVED" : "EXERCISE_RESTORED",
      entityType: "EXERCISE",
      entityId: id,
      summary: `${status === "ARCHIVED" ? "Archived" : "Restored"} exercise ${exercise.code}`,
      changes: { status: { from, to: status } },
    });
  }
  return toDTO(exercise.toObject());
}

export async function exerciseUsage(id: string) {
  const [planDays, logs] = await Promise.all([
    WorkoutPlanDay.countDocuments({ "exercises.exerciseId": id }),
    ExerciseLog.countDocuments({ exerciseId: id }),
  ]);
  return { planDays, exerciseLogs: logs, inUse: planDays + logs > 0 };
}

/** Hard delete is only allowed for exercises that nothing references. */
export async function deleteExercise(req: Request, id: string) {
  const exercise = await Exercise.findById(id);
  if (!exercise) throw HttpError.notFound("Exercise");
  const usage = await exerciseUsage(id);
  if (usage.inUse) {
    throw HttpError.conflict(
      "This exercise is used by workout plans or logged workouts. Archive it instead.",
      "EXERCISE_IN_USE",
    );
  }
  await exercise.deleteOne();
  await recordAudit(req, {
    action: "EXERCISE_DELETED",
    entityType: "EXERCISE",
    entityId: id,
    summary: `Deleted unused exercise ${exercise.code} ${exercise.name}`,
  });
}
