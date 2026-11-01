import { Schema, model, type Types } from "mongoose";
import { DEFAULT_TARGET_SETTINGS, TARGET_METHODS, type TargetMethod, type TargetSettings } from "@recomptrack/shared";

/** Singleton document (key "default") with the admin's target calculation defaults. */
export interface IGoalConfiguration extends TargetSettings {
  _id: Types.ObjectId;
  key: string;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
}

const goalConfigurationSchema = new Schema<IGoalConfiguration>(
  {
    key: { type: String, required: true, default: "default" },
    equation: { type: String, default: DEFAULT_TARGET_SETTINGS.equation },
    activityMultipliers: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_TARGET_SETTINGS.activityMultipliers }) },
    goalCalorieAdjustmentPercent: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_TARGET_SETTINGS.goalCalorieAdjustmentPercent }) },
    proteinGPerKg: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_TARGET_SETTINGS.proteinGPerKg }) },
    fatMinGPerKg: { type: Number, default: DEFAULT_TARGET_SETTINGS.fatMinGPerKg },
    fatPercentOfCalories: { type: Number, default: DEFAULT_TARGET_SETTINGS.fatPercentOfCalories },
    fibreGPer1000Kcal: { type: Number, default: DEFAULT_TARGET_SETTINGS.fibreGPer1000Kcal },
    minimumCalories: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_TARGET_SETTINGS.minimumCalories }) },
    reviewIntervalWeeks: { type: Number, default: DEFAULT_TARGET_SETTINGS.reviewIntervalWeeks },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
goalConfigurationSchema.index({ key: 1 }, { unique: true });
export const GoalConfiguration = model<IGoalConfiguration>("GoalConfiguration", goalConfigurationSchema, "goalConfigurations");

/**
 * Append-only history of a user's daily targets. The newest by effectiveFrom applies.
 * CALCULATED rows come from the user's profile; MANUAL rows are set by an admin and
 * take precedence until the user (or admin) recalculates.
 */
export interface INutritionTarget {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre: number;
  method: TargetMethod;
  effectiveFrom: Date;
  inputs: Record<string, unknown> | null;
  breakdown: Record<string, unknown> | null;
  note: string | null;
  setBy: Types.ObjectId | null;
  createdAt: Date;
}

const nutritionTargetSchema = new Schema<INutritionTarget>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbohydrates: { type: Number, required: true },
    fat: { type: Number, required: true },
    fibre: { type: Number, required: true },
    method: { type: String, enum: TARGET_METHODS, required: true },
    effectiveFrom: { type: Date, required: true },
    inputs: { type: Schema.Types.Mixed, default: null },
    breakdown: { type: Schema.Types.Mixed, default: null },
    note: { type: String, default: null },
    setBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
nutritionTargetSchema.index({ userId: 1, effectiveFrom: -1 });
export const NutritionTarget = model<INutritionTarget>("NutritionTarget", nutritionTargetSchema, "nutritionTargets");
