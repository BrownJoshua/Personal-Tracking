import type { NutritionDTO } from "../types";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Scale nutrition values from the food's serving basis to an eaten quantity.
 * `quantity` and `servingBasis` are in the same unit (g or ml).
 *
 * Example: chicken breast, 165 kcal per 100 g, eaten 150 g -> 247.5 kcal.
 */
export function scaleNutrition(nutrition: NutritionDTO, servingBasis: number, quantity: number): NutritionDTO {
  if (!(servingBasis > 0)) throw new RangeError("servingBasis must be positive");
  if (!(quantity >= 0) || !Number.isFinite(quantity)) throw new RangeError("quantity must be a non-negative number");
  const f = quantity / servingBasis;
  const opt = (v: number | null) => (v === null ? null : round1(v * f));
  return {
    calories: round1(nutrition.calories * f),
    protein: round1(nutrition.protein * f),
    carbohydrates: round1(nutrition.carbohydrates * f),
    fat: round1(nutrition.fat * f),
    fibre: round1(nutrition.fibre * f),
    sugar: opt(nutrition.sugar),
    saturatedFat: opt(nutrition.saturatedFat),
    sodiumMg: opt(nutrition.sodiumMg),
  };
}

/** Energy implied by macros (4/4/9 kcal per g). Used to flag implausible entries. */
export function caloriesFromMacros(n: Pick<NutritionDTO, "protein" | "carbohydrates" | "fat">): number {
  return round1(n.protein * 4 + n.carbohydrates * 4 + n.fat * 9);
}
