import type { ActivityLevel, GoalType, Sex } from "../constants";
import { ageOn } from "./units";

/** Admin-configurable defaults. Stored in `goalConfigurations`; these are the initial values. */
export interface TargetSettings {
  equation: "MIFFLIN_ST_JEOR";
  activityMultipliers: Record<ActivityLevel, number>;
  /** Percentage change applied to maintenance calories, e.g. -20 for a 20% deficit. */
  goalCalorieAdjustmentPercent: Record<GoalType, number>;
  proteinGPerKg: Record<GoalType, number>;
  fatMinGPerKg: number;
  fatPercentOfCalories: number;
  fibreGPer1000Kcal: number;
  minimumCalories: Record<Sex, number>;
  reviewIntervalWeeks: number;
}

export const DEFAULT_TARGET_SETTINGS: TargetSettings = {
  equation: "MIFFLIN_ST_JEOR",
  activityMultipliers: { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, VERY_ACTIVE: 1.9 },
  goalCalorieAdjustmentPercent: { FAT_LOSS: -20, MUSCLE_GAIN: 10, RECOMPOSITION: -10 },
  proteinGPerKg: { FAT_LOSS: 2.0, MUSCLE_GAIN: 1.8, RECOMPOSITION: 2.0 },
  fatMinGPerKg: 0.6,
  fatPercentOfCalories: 25,
  fibreGPer1000Kcal: 14,
  minimumCalories: { FEMALE: 1200, MALE: 1500 },
  reviewIntervalWeeks: 3,
};

export interface TargetInputs {
  dateOfBirth: string | null;
  heightCm: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  weightKg: number | null;
  goalType: GoalType | null;
}

export interface CalculatedTargets {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre: number;
  breakdown: { bmr: number; maintenance: number; adjustmentPercent: number; age: number; weightKg: number; flooredToMinimum: boolean };
}

export type TargetResult = { ok: true; targets: CalculatedTargets } | { ok: false; missing: (keyof TargetInputs)[] };

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Daily targets from the Mifflin-St Jeor equation. Deliberately ignores exercise calories:
 * activity is captured once by the multiplier, so workouts are never double-counted.
 */
export function calculateTargets(input: TargetInputs, settings: TargetSettings = DEFAULT_TARGET_SETTINGS, today = new Date()): TargetResult {
  const missing = (Object.keys(input) as (keyof TargetInputs)[]).filter((k) => input[k] === null || input[k] === undefined);
  if (missing.length) return { ok: false, missing };
  const { dateOfBirth, heightCm, sex, activityLevel, weightKg, goalType } = input as { [K in keyof TargetInputs]: NonNullable<TargetInputs[K]> };

  const age = ageOn(dateOfBirth, today);
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "MALE" ? 5 : -161);
  const maintenance = bmr * settings.activityMultipliers[activityLevel];
  const adjustmentPercent = settings.goalCalorieAdjustmentPercent[goalType];
  let calories = maintenance * (1 + adjustmentPercent / 100);
  const floor = settings.minimumCalories[sex];
  const flooredToMinimum = calories < floor;
  calories = roundTo(Math.max(calories, floor), 10);

  const protein = Math.round(weightKg * settings.proteinGPerKg[goalType]);
  const fat = Math.round(Math.max(weightKg * settings.fatMinGPerKg, (calories * settings.fatPercentOfCalories) / 100 / 9));
  const carbohydrates = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fibre = Math.round((calories / 1000) * settings.fibreGPer1000Kcal);

  return {
    ok: true,
    targets: {
      calories,
      protein,
      carbohydrates,
      fat,
      fibre,
      breakdown: { bmr: Math.round(bmr), maintenance: Math.round(maintenance), adjustmentPercent, age, weightKg, flooredToMinimum },
    },
  };
}
