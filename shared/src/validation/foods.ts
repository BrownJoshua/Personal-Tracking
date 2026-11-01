import { z } from "zod";
import { FOOD_CATEGORIES, FOOD_KINDS, FOOD_PREPARATIONS, FOOD_SOURCES, SERVING_UNITS } from "../constants";
import { optionalText, searchQuerySchema, statusFilterSchema, text } from "./common";

const grams = z.number().min(0).max(1000);

export const nutritionSchema = z
  .object({
    calories: z.number().min(0).max(1000),
    protein: grams,
    carbohydrates: grams,
    fat: grams,
    fibre: grams.default(0),
    sugar: grams.nullable().default(null),
    saturatedFat: grams.nullable().default(null),
    sodiumMg: z.number().min(0).max(100000).nullable().default(null),
  })
  .strict();
export type NutritionInput = z.input<typeof nutritionSchema>;

export const servingSizeSchema = z
  .object({
    label: text(40), // e.g. "1 breast", "1 cup"
    quantity: z.number().positive().max(5000), // in servingUnit (g or ml)
  })
  .strict();

const foodBase = z
  .object({
    name: text(120),
    kind: z.enum(FOOD_KINDS),
    brand: optionalText(80),
    barcode: z
      .string()
      .trim()
      .regex(/^\d{8,14}$/, "Barcode must be 8–14 digits")
      .nullable()
      .optional(),
    category: z.enum(FOOD_CATEGORIES),
    preparation: z.enum(FOOD_PREPARATIONS),
    /** Nutrition values are per `servingBasis` `servingUnit` — normally 100 g. */
    servingBasis: z.number().positive().max(1000).default(100),
    servingUnit: z.enum(SERVING_UNITS).default("GRAM"),
    servingSizes: z.array(servingSizeSchema).max(10).default([]),
    nutrition: nutritionSchema,
    source: z.enum(FOOD_SOURCES),
    sourceReference: optionalText(300),
  })
  .strict();

type FoodShape = {
  kind?: string;
  brand?: string | null;
  servingBasis?: number;
  servingUnit?: string;
  nutrition?: { protein: number; carbohydrates: number; fat: number; fibre?: number };
};

function addFoodIssues(v: FoodShape, ctx: z.RefinementCtx) {
  if (v.kind === "BRANDED" && !v.brand) {
    ctx.addIssue({ code: "custom", message: "Branded foods need a brand", path: ["brand"] });
  }
  if (v.kind === "GENERIC" && v.brand) {
    ctx.addIssue({ code: "custom", message: "Generic foods must not have a brand", path: ["brand"] });
  }
  // Macronutrient mass cannot exceed the serving mass (only meaningful for grams).
  if (v.nutrition && (v.servingUnit ?? "GRAM") === "GRAM") {
    const basis = v.servingBasis ?? 100;
    const n = v.nutrition;
    if (n.protein + n.carbohydrates + n.fat > basis * 1.001) {
      ctx.addIssue({
        code: "custom",
        message: `Protein + carbohydrates + fat exceed ${basis} g`,
        path: ["nutrition"],
      });
    }
  }
}

export const createFoodSchema = foodBase.superRefine(addFoodIssues);
export type CreateFoodInput = z.input<typeof createFoodSchema>;

/** Partial update. Cross-field rules are re-checked on the merged document by the server. */
export const updateFoodSchema = foodBase
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateFoodInput = z.input<typeof updateFoodSchema>;

/** Validate a fully merged food (existing + patch). */
export const foodDocumentSchema = foodBase.superRefine(addFoodIssues);

export const foodListQuerySchema = searchQuerySchema.extend({
  status: statusFilterSchema,
  category: z.enum(FOOD_CATEGORIES).optional(),
  kind: z.enum(FOOD_KINDS).optional(),
});
