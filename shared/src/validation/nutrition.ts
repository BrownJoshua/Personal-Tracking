import { z } from "zod";
import { GOAL_TYPES, MEAL_TYPES, PLAN_STATUSES, SERVING_UNITS, SEXES, ACTIVITY_LEVELS } from "../constants";
import { isoDateSchema, objectIdSchema, optionalText, paginationQuerySchema, searchQuerySchema, text } from "./common";
import { nutritionSchema } from "./foods";

const quantity = z.number().positive("Enter an amount").max(5000);

export const createFoodLogSchema = z
  .object({
    foodId: objectIdSchema.optional(),
    customFoodId: objectIdSchema.optional(),
    quantity,
    mealType: z.enum(MEAL_TYPES),
    /** Defaults to today in the user's time zone. */
    localDate: isoDateSchema.optional(),
  })
  .strict()
  .refine((v) => !!v.foodId !== !!v.customFoodId, { message: "Choose one food", path: ["foodId"] });
export type CreateFoodLogInput = z.input<typeof createFoodLogSchema>;

export const updateFoodLogSchema = z
  .object({ quantity, mealType: z.enum(MEAL_TYPES) })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const diaryQuerySchema = z.object({ date: isoDateSchema.optional() });
export const historyQuerySchema = z.object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() });

export const logMealSchema = z
  .object({
    mealType: z.enum(MEAL_TYPES),
    localDate: isoDateSchema.optional(),
    /** Portion multiplier, e.g. 0.5 for half the template. */
    portion: z.number().min(0.1).max(5).default(1),
  })
  .strict();

export const customFoodSchema = z
  .object({
    name: text(120),
    brand: optionalText(80),
    servingBasis: z.number().positive().max(1000).default(100),
    servingUnit: z.enum(SERVING_UNITS).default("GRAM"),
    nutrition: nutritionSchema,
  })
  .strict();
export type CustomFoodInput = z.input<typeof customFoodSchema>;

const mealItemSchema = z
  .object({ foodId: objectIdSchema.optional(), customFoodId: objectIdSchema.optional(), quantity })
  .strict()
  .refine((v) => !!v.foodId !== !!v.customFoodId, { message: "Choose one food", path: ["foodId"] });

export const savedMealSchema = z
  .object({
    name: text(80),
    items: z.array(mealItemSchema).min(1, "Add at least one food").max(30),
  })
  .strict();
export type SavedMealInput = z.input<typeof savedMealSchema>;

/** Save the foods logged in one meal of one day as a reusable meal. */
export const saveMealFromDiarySchema = z
  .object({ name: text(80), localDate: isoDateSchema, mealType: z.enum(MEAL_TYPES) })
  .strict();

// ---- Admin: meal templates ---------------------------------------------
export const mealTemplateSchema = z
  .object({
    name: text(120),
    description: optionalText(1000),
    mealType: z.enum(MEAL_TYPES),
    tags: z.array(text(30)).max(10).default([]),
    ingredients: z
      .array(z.object({ foodId: objectIdSchema, quantity }).strict())
      .min(1, "Add at least one ingredient")
      .max(30),
  })
  .strict();
export type MealTemplateInput = z.input<typeof mealTemplateSchema>;

export const mealTemplateListQuerySchema = searchQuerySchema.extend({
  status: z.enum([...PLAN_STATUSES, "ALL"]).optional(),
  mealType: z.enum(MEAL_TYPES).optional(),
});

export const assignMealTemplateSchema = z
  .object({ userId: objectIdSchema, mealTemplateId: objectIdSchema, startDate: isoDateSchema })
  .strict();

// ---- Targets ----------------------------------------------------------
const perGoal = (min: number, max: number) =>
  z.object(Object.fromEntries(GOAL_TYPES.map((g) => [g, z.number().min(min).max(max)])) as Record<(typeof GOAL_TYPES)[number], z.ZodNumber>).strict();

export const targetSettingsSchema = z
  .object({
    equation: z.literal("MIFFLIN_ST_JEOR"),
    activityMultipliers: z
      .object(Object.fromEntries(ACTIVITY_LEVELS.map((a) => [a, z.number().min(1).max(2.5)])) as Record<(typeof ACTIVITY_LEVELS)[number], z.ZodNumber>)
      .strict(),
    goalCalorieAdjustmentPercent: perGoal(-35, 25),
    proteinGPerKg: perGoal(0.8, 3),
    fatMinGPerKg: z.number().min(0.3).max(1.5),
    fatPercentOfCalories: z.number().min(15).max(45),
    fibreGPer1000Kcal: z.number().min(5).max(30),
    minimumCalories: z
      .object(Object.fromEntries(SEXES.map((s) => [s, z.number().int().min(1000).max(2500)])) as Record<(typeof SEXES)[number], z.ZodNumber>)
      .strict(),
    reviewIntervalWeeks: z.number().int().min(1).max(12),
  })
  .strict();

/** Admin sets an individual recommendation for one user. */
export const manualTargetSchema = z
  .object({
    calories: z.number().int().min(800).max(6000),
    protein: z.number().int().min(0).max(500),
    carbohydrates: z.number().int().min(0).max(1000),
    fat: z.number().int().min(0).max(400),
    fibre: z.number().int().min(0).max(100),
    note: optionalText(300),
  })
  .strict();

export const nutritionLogsPageQuery = paginationQuerySchema;
