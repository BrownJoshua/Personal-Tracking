import {
  MEAL_TYPES,
  addDays,
  daysBetween,
  localDateInZone,
  scaleNutrition,
  sumNutrition,
  type CustomFoodDTO,
  type DiaryDayDTO,
  type FoodLogDTO,
  type MealAssignmentDTO,
  type MealType,
  type NutritionDTO,
  type NutritionHistoryDayDTO,
  type SavedMealDTO,
} from "@recomptrack/shared";
import type { Types } from "mongoose";
import { HttpError } from "../../utils/httpError";
import { idOf, toObjectId } from "../../utils/serialize";
import { getStatus } from "../targets/targets.service";
import { UserPreference } from "../users/userPreference.model";
import { Food, type INutrition } from "./food.model";
import { toFoodDTO } from "./foods.service";
import { toTemplateDTOs } from "./mealTemplates.service";
import { CustomFood, FoodLog, MealTemplate, SavedMeal, UserMealAssignment, type ICustomFood, type IFoodLog } from "./nutrition.models";

/** All functions take the authenticated user id; every query filters by it. */

const unitOf = (u: string) => (u === "MILLILITRE" ? "ml" : "g") as "g" | "ml";

function nutritionDTO(n: Partial<INutrition>): NutritionDTO {
  return {
    calories: n.calories ?? 0,
    protein: n.protein ?? 0,
    carbohydrates: n.carbohydrates ?? 0,
    fat: n.fat ?? 0,
    fibre: n.fibre ?? 0,
    sugar: n.sugar ?? null,
    saturatedFat: n.saturatedFat ?? null,
    sodiumMg: n.sodiumMg ?? null,
  };
}

async function todayFor(userId: string) {
  const tz = (await UserPreference.findOne({ userId }).select({ timezone: 1 }).lean())?.timezone ?? "UTC";
  return localDateInZone(new Date(), tz);
}

function toLogDTO(l: IFoodLog): FoodLogDTO {
  return {
    id: idOf(l._id),
    localDate: l.localDate,
    mealType: l.mealType,
    quantity: l.quantity,
    unit: unitOf(l.foodSnapshot.servingUnit),
    food: {
      id: l.foodId ? idOf(l.foodId) : null,
      customFoodId: l.customFoodId ? idOf(l.customFoodId) : null,
      name: l.foodSnapshot.name,
      brand: l.foodSnapshot.brand,
      preparation: l.foodSnapshot.preparation,
    },
    mealTemplateId: l.mealTemplateId ? idOf(l.mealTemplateId) : null,
    nutrition: nutritionDTO(l.nutritionSnapshot),
    loggedAt: l.loggedAt.toISOString(),
  };
}

export function toCustomFoodDTO(f: ICustomFood): CustomFoodDTO {
  return {
    id: idOf(f._id),
    name: f.name,
    brand: f.brand,
    servingBasis: f.servingBasis,
    servingUnit: f.servingUnit,
    nutrition: nutritionDTO(f.nutrition),
    createdAt: f.createdAt.toISOString(),
  };
}

/** Load a food for logging: public foods must be active; custom foods must belong to the user. */
async function resolveFood(userId: string, ref: { foodId?: string | null; customFoodId?: string | null }, opts: { allowArchived?: boolean } = {}) {
  if (ref.foodId) {
    const f = await Food.findOne({ _id: ref.foodId, ...(opts.allowArchived ? {} : { status: "ACTIVE" }) }).lean();
    if (!f) throw HttpError.notFound("Food");
    const dto = toFoodDTO(f);
    return {
      foodId: f._id as Types.ObjectId,
      customFoodId: null,
      snapshot: { name: f.name, brand: f.brand, preparation: f.preparation, servingBasis: f.servingBasis, servingUnit: f.servingUnit },
      basis: dto.nutrition,
    };
  }
  const c = await CustomFood.findOne({ _id: ref.customFoodId, userId }).lean();
  if (!c) throw HttpError.notFound("Food");
  return {
    foodId: null,
    customFoodId: c._id as Types.ObjectId,
    snapshot: { name: c.name, brand: c.brand, preparation: null, servingBasis: c.servingBasis, servingUnit: c.servingUnit },
    basis: nutritionDTO(c.nutrition),
  };
}

function logDoc(userId: string, food: Awaited<ReturnType<typeof resolveFood>>, quantity: number, mealType: MealType, localDate: string, mealTemplateId: Types.ObjectId | null = null) {
  return {
    userId: toObjectId(userId),
    foodId: food.foodId,
    customFoodId: food.customFoodId,
    mealTemplateId,
    localDate,
    loggedAt: new Date(),
    mealType,
    quantity,
    foodSnapshot: food.snapshot,
    basisNutritionSnapshot: food.basis,
    nutritionSnapshot: scaleNutrition(food.basis, food.snapshot.servingBasis, quantity),
  };
}

export async function createLog(userId: string, input: { foodId?: string; customFoodId?: string; quantity: number; mealType: MealType; localDate?: string }) {
  const food = await resolveFood(userId, input);
  const localDate = input.localDate ?? (await todayFor(userId));
  const doc = await FoodLog.create(logDoc(userId, food, input.quantity, input.mealType, localDate));
  return toLogDTO(doc.toObject());
}

/** Changing the quantity recomputes from the snapshot taken at logging time, not the current food. */
export async function updateLog(userId: string, id: string, input: { quantity?: number; mealType?: MealType }) {
  const log = await FoodLog.findOne({ _id: id, userId });
  if (!log) throw HttpError.notFound("Food log");
  if (input.mealType) log.mealType = input.mealType;
  if (input.quantity !== undefined) {
    log.quantity = input.quantity;
    log.nutritionSnapshot = scaleNutrition(nutritionDTO(log.basisNutritionSnapshot), log.foodSnapshot.servingBasis, input.quantity);
  }
  await log.save();
  return toLogDTO(log.toObject());
}

export async function deleteLog(userId: string, id: string) {
  const r = await FoodLog.deleteOne({ _id: id, userId });
  if (r.deletedCount === 0) throw HttpError.notFound("Food log");
}

export async function diary(userId: string, date?: string): Promise<DiaryDayDTO> {
  const day = date ?? (await todayFor(userId));
  const [logs, status] = await Promise.all([
    FoodLog.find({ userId, localDate: day }).sort({ loggedAt: 1 }).lean(),
    getStatus(userId, { includeBreakdown: false }),
  ]);
  const entries = logs.map(toLogDTO);
  const meals = Object.fromEntries(
    MEAL_TYPES.map((m) => {
      const list = entries.filter((e) => e.mealType === m);
      return [m, { entries: list, totals: sumNutrition(list.map((e) => e.nutrition)) }];
    }),
  ) as DiaryDayDTO["meals"];
  return { date: day, meals, totals: sumNutrition(entries.map((e) => e.nutrition)), target: status.target };
}

export async function history(userId: string, from?: string, to?: string): Promise<NutritionHistoryDayDTO[]> {
  const end = to ?? (await todayFor(userId));
  const start = from ?? addDays(end, -6);
  if (daysBetween(start, end) < 0 || daysBetween(start, end) > 92) {
    throw HttpError.validation([{ path: "from", message: "Choose a range of up to 93 days" }]);
  }
  const rows = await FoodLog.aggregate<{ _id: string; entries: number; calories: number; protein: number; carbohydrates: number; fat: number; fibre: number }>([
    { $match: { userId: toObjectId(userId), localDate: { $gte: start, $lte: end } } },
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
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const out: NutritionHistoryDayDTO[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const r = byDay.get(d);
    // Days without logs are reported as empty — never as zero intake estimates.
    out.push({ date: d, entries: r?.entries ?? 0, totals: sumNutrition(r ? [nutritionDTO(r)] : []) });
  }
  return out;
}

export async function recentFoods(userId: string) {
  const rows = await FoodLog.aggregate<{ _id: { foodId: unknown; customFoodId: unknown }; name: string; brand: string | null; lastQuantity: number; unit: string }>([
    { $match: { userId: toObjectId(userId) } },
    { $sort: { loggedAt: -1 } },
    { $limit: 200 },
    {
      $group: {
        _id: { foodId: "$foodId", customFoodId: "$customFoodId" },
        name: { $first: "$foodSnapshot.name" },
        brand: { $first: "$foodSnapshot.brand" },
        lastQuantity: { $first: "$quantity" },
        unit: { $first: "$foodSnapshot.servingUnit" },
        last: { $first: "$loggedAt" },
      },
    },
    { $sort: { last: -1 } },
    { $limit: 15 },
  ]);
  return rows.map((r) => ({
    foodId: r._id.foodId ? idOf(r._id.foodId) : null,
    customFoodId: r._id.customFoodId ? idOf(r._id.customFoodId) : null,
    name: r.name,
    brand: r.brand,
    lastQuantity: r.lastQuantity,
    unit: unitOf(r.unit),
  }));
}

// ---- Custom foods (private) ---------------------------------------------

type CustomFoodInput = { name: string; brand?: string | null; servingBasis: number; servingUnit: "GRAM" | "MILLILITRE"; nutrition: INutrition };

export async function listCustomFoods(userId: string) {
  return (await CustomFood.find({ userId }).sort({ name: 1 }).lean()).map(toCustomFoodDTO);
}
export async function createCustomFood(userId: string, input: CustomFoodInput) {
  return toCustomFoodDTO((await CustomFood.create({ ...input, brand: input.brand ?? null, userId })).toObject());
}
export async function updateCustomFood(userId: string, id: string, input: CustomFoodInput) {
  const f = await CustomFood.findOneAndUpdate({ _id: id, userId }, { $set: { ...input, brand: input.brand ?? null } }, { returnDocument: "after" }).lean();
  if (!f) throw HttpError.notFound("Food");
  return toCustomFoodDTO(f);
}
export async function deleteCustomFood(userId: string, id: string) {
  // Logged entries keep their snapshot, so deleting the food never changes past intake.
  const r = await CustomFood.deleteOne({ _id: id, userId });
  if (r.deletedCount === 0) throw HttpError.notFound("Food");
}

// ---- Saved meals ---------------------------------------------------------

async function toSavedMealDTOs(userId: string, meals: { _id: unknown; name: string; items: { foodId: unknown; customFoodId: unknown; quantity: number }[]; createdAt: Date }[]): Promise<SavedMealDTO[]> {
  const foodIds = meals.flatMap((m) => m.items.filter((i) => i.foodId).map((i) => idOf(i.foodId)));
  const customIds = meals.flatMap((m) => m.items.filter((i) => i.customFoodId).map((i) => idOf(i.customFoodId)));
  const [foods, customs] = await Promise.all([Food.find({ _id: { $in: foodIds } }).lean(), CustomFood.find({ _id: { $in: customIds }, userId }).lean()]);
  const fMap = new Map(foods.map((f) => [idOf(f._id), f]));
  const cMap = new Map(customs.map((c) => [idOf(c._id), c]));
  return meals.map((m) => {
    const items = m.items.map((i) => {
      const f = i.foodId ? fMap.get(idOf(i.foodId)) : undefined;
      const c = i.customFoodId ? cMap.get(idOf(i.customFoodId)) : undefined;
      const src = f ? { name: f.name, basis: toFoodDTO(f).nutrition, servingBasis: f.servingBasis, unit: f.servingUnit } : c ? { name: c.name, basis: nutritionDTO(c.nutrition), servingBasis: c.servingBasis, unit: c.servingUnit } : null;
      return {
        foodId: i.foodId ? idOf(i.foodId) : null,
        customFoodId: i.customFoodId ? idOf(i.customFoodId) : null,
        name: src?.name ?? "Unavailable food",
        quantity: i.quantity,
        unit: unitOf(src?.unit ?? "GRAM"),
        nutrition: src ? scaleNutrition(src.basis, src.servingBasis, i.quantity) : nutritionDTO({}),
        available: !!src && (!f || f.status === "ACTIVE"),
      };
    });
    return { id: idOf(m._id), name: m.name, items, totals: sumNutrition(items.map((i) => i.nutrition)), createdAt: m.createdAt.toISOString() };
  });
}

export async function listSavedMeals(userId: string) {
  return toSavedMealDTOs(userId, await SavedMeal.find({ userId }).sort({ name: 1 }).lean());
}

export async function createSavedMeal(userId: string, input: { name: string; items: { foodId?: string; customFoodId?: string; quantity: number }[] }) {
  for (const item of input.items) await resolveFood(userId, item); // validates ownership & availability
  const meal = await SavedMeal.create({
    userId,
    name: input.name,
    items: input.items.map((i) => ({ foodId: i.foodId ?? null, customFoodId: i.customFoodId ?? null, quantity: i.quantity })),
  });
  return (await toSavedMealDTOs(userId, [meal.toObject()]))[0]!;
}

export async function saveMealFromDiary(userId: string, input: { name: string; localDate: string; mealType: MealType }) {
  const logs = await FoodLog.find({ userId, localDate: input.localDate, mealType: input.mealType }).lean();
  if (logs.length === 0) throw HttpError.validation([{ path: "mealType", message: "Nothing is logged in that meal" }]);
  const meal = await SavedMeal.create({
    userId,
    name: input.name,
    items: logs.map((l) => ({ foodId: l.foodId, customFoodId: l.customFoodId, quantity: l.quantity })),
  });
  return (await toSavedMealDTOs(userId, [meal.toObject()]))[0]!;
}

export async function deleteSavedMeal(userId: string, id: string) {
  const r = await SavedMeal.deleteOne({ _id: id, userId });
  if (r.deletedCount === 0) throw HttpError.notFound("Saved meal");
}

export async function logSavedMeal(userId: string, id: string, input: { mealType: MealType; localDate?: string; portion: number }) {
  const meal = await SavedMeal.findOne({ _id: id, userId }).lean();
  if (!meal) throw HttpError.notFound("Saved meal");
  const localDate = input.localDate ?? (await todayFor(userId));
  const docs = [];
  for (const item of meal.items) {
    const food = await resolveFood(userId, { foodId: item.foodId ? idOf(item.foodId) : null, customFoodId: item.customFoodId ? idOf(item.customFoodId) : null }).catch(() => null);
    if (food) docs.push(logDoc(userId, food, Math.round(item.quantity * input.portion * 10) / 10, input.mealType, localDate));
  }
  if (docs.length === 0) throw HttpError.conflict("None of the foods in this meal are available any more", "MEAL_UNAVAILABLE");
  await FoodLog.insertMany(docs);
  return { logged: docs.length, skipped: meal.items.length - docs.length };
}

// ---- Assigned meal plans ---------------------------------------------------

export async function assignedMeals(userId: string): Promise<MealAssignmentDTO[]> {
  const rows = await UserMealAssignment.find({ userId, status: "ACTIVE" }).sort({ startDate: 1 }).lean();
  const templates = await MealTemplate.find({ _id: { $in: rows.map((r) => r.mealTemplateId) } }).lean();
  const dtos = new Map((await toTemplateDTOs(templates)).map((t) => [t.id, t]));
  return rows
    .filter((r) => dtos.has(idOf(r.mealTemplateId)))
    .map((r) => ({
      id: idOf(r._id),
      mealTemplate: dtos.get(idOf(r.mealTemplateId))!,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate?.toISOString() ?? null,
      status: r.status,
    }));
}

/** Log an assigned meal template: one diary entry per ingredient, tagged with the template. */
export async function logAssignedMeal(userId: string, assignmentId: string, input: { mealType: MealType; localDate?: string; portion: number }) {
  const a = await UserMealAssignment.findOne({ _id: assignmentId, userId, status: "ACTIVE" }).lean();
  if (!a) throw HttpError.notFound("Meal plan");
  const t = await MealTemplate.findById(a.mealTemplateId).lean();
  if (!t) throw HttpError.notFound("Meal plan");
  const localDate = input.localDate ?? (await todayFor(userId));
  const docs = [];
  for (const i of t.ingredients) {
    const food = await resolveFood(userId, { foodId: idOf(i.foodId) }, { allowArchived: true }).catch(() => null);
    if (food) docs.push(logDoc(userId, food, Math.round(i.quantity * input.portion * 10) / 10, input.mealType, localDate, t._id));
  }
  await FoodLog.insertMany(docs);
  return { logged: docs.length, skipped: t.ingredients.length - docs.length };
}
