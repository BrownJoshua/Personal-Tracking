import type { Request } from "express";
import {
  DEFAULT_TARGET_SETTINGS,
  calculateTargets,
  type NutritionTargetDTO,
  type TargetSettings,
  type TargetStatusDTO,
} from "@recomptrack/shared";
import { diff } from "../../utils/diff";
import { toObjectId } from "../../utils/serialize";
import { recordAudit } from "../audit/audit.service";
import { BodyMeasurement } from "../measurements/bodyMeasurement.model";
import { UserGoal } from "../users/userGoal.model";
import { UserProfile } from "../users/userProfile.model";
import { GoalConfiguration, NutritionTarget, type INutritionTarget } from "./targets.models";

const SETTING_KEYS = Object.keys(DEFAULT_TARGET_SETTINGS) as (keyof TargetSettings)[];

export async function getSettings(): Promise<TargetSettings> {
  const doc = await GoalConfiguration.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, doc![k] ?? DEFAULT_TARGET_SETTINGS[k]])) as unknown as TargetSettings;
}

export async function updateSettings(req: Request, input: TargetSettings): Promise<TargetSettings> {
  const before = await getSettings();
  await GoalConfiguration.updateOne({ key: "default" }, { $set: { ...input, updatedBy: req.auth!.userId } });
  const after = await getSettings();
  await recordAudit(req, {
    action: "TARGET_SETTINGS_UPDATED",
    entityType: "TARGET_SETTINGS",
    summary: "Updated nutrition target defaults",
    changes: diff(before as never, after as never),
  });
  return after;
}

export function toTargetDTO(t: INutritionTarget, opts: { includeBreakdown: boolean }): NutritionTargetDTO {
  return {
    calories: t.calories,
    protein: t.protein,
    carbohydrates: t.carbohydrates,
    fat: t.fat,
    fibre: t.fibre,
    method: t.method,
    effectiveFrom: t.effectiveFrom.toISOString(),
    note: t.note,
    breakdown: opts.includeBreakdown ? ((t.breakdown as NutritionTargetDTO["breakdown"]) ?? null) : null,
  };
}

export async function currentTarget(userId: string) {
  return NutritionTarget.findOne({ userId, effectiveFrom: { $lte: new Date() } }).sort({ effectiveFrom: -1, _id: -1 }).lean();
}

async function gatherInputs(userId: string) {
  const [profile, goal, weight] = await Promise.all([
    UserProfile.findOne({ userId }).lean(),
    UserGoal.findOne({ userId, status: "ACTIVE" }).lean(),
    BodyMeasurement.findOne({ userId, "measurements.weightKg": { $ne: null } }).sort({ recordedAt: -1 }).lean(),
  ]);
  return {
    dateOfBirth: profile?.dateOfBirth ?? null,
    heightCm: profile?.heightCm ?? null,
    sex: profile?.sex ?? null,
    activityLevel: profile?.activityLevel ?? null,
    weightKg: weight?.measurements.weightKg ?? null,
    goalType: goal?.goalType ?? null,
  };
}

/** Calculate from the user's own profile and store a CALCULATED target. */
export async function recalculate(userId: string) {
  const [inputs, settings] = await Promise.all([gatherInputs(userId), getSettings()]);
  const result = calculateTargets(inputs, settings);
  if (!result.ok) return { target: null, missing: result.missing as string[] };
  const { breakdown, ...values } = result.targets;
  const target = await NutritionTarget.create({
    userId: toObjectId(userId),
    ...values,
    method: "CALCULATED",
    effectiveFrom: new Date(),
    inputs,
    breakdown,
    note: null,
    setBy: null,
  });
  return { target: target.toObject(), missing: [] as string[] };
}

/**
 * Called after profile, goal or weight changes. Recalculates unless an admin has set a
 * manual target, which stays in force until someone deliberately recalculates.
 */
export async function refreshIfCalculated(userId: string) {
  const current = await currentTarget(userId);
  if (current?.method === "MANUAL") return;
  if (current?.method === "CALCULATED") {
    const inputs = await gatherInputs(userId);
    if (JSON.stringify(inputs) === JSON.stringify(current.inputs)) return;
  }
  await recalculate(userId);
}

export async function getStatus(userId: string, opts: { includeBreakdown: boolean }): Promise<TargetStatusDTO> {
  let target = await currentTarget(userId);
  let missing: string[] = [];
  if (!target) {
    const r = await recalculate(userId);
    target = r.target;
    missing = r.missing;
  }
  const settings = await getSettings();
  const reviewDue = !!target && Date.now() - target.effectiveFrom.getTime() > settings.reviewIntervalWeeks * 7 * 86_400_000;
  return { target: target ? toTargetDTO(target, opts) : null, missing, reviewDue };
}

export async function setManualTarget(
  req: Request,
  userId: string,
  input: { calories: number; protein: number; carbohydrates: number; fat: number; fibre: number; note?: string | null },
) {
  const before = await currentTarget(userId);
  const t = await NutritionTarget.create({
    userId: toObjectId(userId),
    calories: input.calories,
    protein: input.protein,
    carbohydrates: input.carbohydrates,
    fat: input.fat,
    fibre: input.fibre,
    method: "MANUAL",
    effectiveFrom: new Date(),
    inputs: null,
    breakdown: null,
    note: input.note ?? null,
    setBy: toObjectId(req.auth!.userId),
  });
  await recordAudit(req, {
    action: "USER_TARGET_SET",
    entityType: "USER",
    entityId: userId,
    summary: `Set individual nutrition target (${input.calories} kcal)`,
    changes: before
      ? diff(
          { calories: before.calories, protein: before.protein, carbohydrates: before.carbohydrates, fat: before.fat, fibre: before.fibre },
          { calories: t.calories, protein: t.protein, carbohydrates: t.carbohydrates, fat: t.fat, fibre: t.fibre },
        )
      : null,
  });
  return t.toObject();
}
