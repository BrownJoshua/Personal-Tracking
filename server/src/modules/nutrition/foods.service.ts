import type { Request } from "express";
import { foodDocumentSchema, type CreateFoodInput, type FoodDTO, type UpdateFoodInput } from "@recomptrack/shared";
import { zodDetails } from "../../middleware/validate";
import { diff } from "../../utils/diff";
import { HttpError } from "../../utils/httpError";
import { paginate, paginated } from "../../utils/pagination";
import { idOf, toObjectId } from "../../utils/serialize";
import { containsRegex, normalizedKey } from "../../utils/text";
import { recordAudit } from "../audit/audit.service";
import { Food, type IFood } from "./food.model";
import { FoodLog, MealTemplate } from "./nutrition.models";

export function toFoodDTO(f: IFood): FoodDTO {
  return {
    id: idOf(f._id),
    name: f.name,
    kind: f.kind,
    brand: f.brand,
    barcode: f.barcode,
    category: f.category,
    preparation: f.preparation,
    servingBasis: f.servingBasis,
    servingUnit: f.servingUnit,
    servingSizes: (f.servingSizes ?? []).map((s) => ({ label: s.label, quantity: s.quantity })),
    nutrition: {
      calories: f.nutrition.calories,
      protein: f.nutrition.protein,
      carbohydrates: f.nutrition.carbohydrates,
      fat: f.nutrition.fat,
      fibre: f.nutrition.fibre ?? 0,
      sugar: f.nutrition.sugar ?? null,
      saturatedFat: f.nutrition.saturatedFat ?? null,
      sodiumMg: f.nutrition.sodiumMg ?? null,
    },
    source: f.source,
    sourceReference: f.sourceReference,
    status: f.status,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

const dedupeKeyOf = (f: { name: string; brand?: string | null; preparation: string }) =>
  normalizedKey(f.name, f.brand, f.preparation);

async function assertUnique(f: { name: string; brand?: string | null; preparation: string; barcode?: string | null }, exceptId?: string) {
  const not = exceptId ? { _id: { $ne: toObjectId(exceptId) } } : {};
  if (await Food.exists({ dedupeKey: dedupeKeyOf(f), ...not })) {
    throw HttpError.conflict(
      `"${f.name}"${f.brand ? ` by ${f.brand}` : ""} (${f.preparation.toLowerCase()}) already exists`,
      "DUPLICATE_FOOD",
    );
  }
  if (f.barcode && (await Food.exists({ barcode: f.barcode, ...not }))) {
    throw HttpError.conflict("Another food already uses this barcode", "DUPLICATE_BARCODE");
  }
}

export interface FoodListQuery {
  q?: string;
  status?: "ACTIVE" | "ARCHIVED" | "ALL";
  category?: string;
  kind?: string;
  page: number;
  limit: number;
}

export async function listFoods(query: FoodListQuery, opts: { activeOnly: boolean }) {
  const filter: Record<string, unknown> = {};
  if (opts.activeOnly) filter.status = "ACTIVE";
  else if (query.status && query.status !== "ALL") filter.status = query.status;
  if (query.q) {
    const rx = containsRegex(query.q);
    filter.$or = [{ name: rx }, { brand: rx }, ...(/^\d{8,14}$/.test(query.q) ? [{ barcode: query.q }] : [])];
  }
  if (query.category) filter.category = query.category;
  if (query.kind) filter.kind = query.kind;

  const { skip, limit } = paginate(query.page, query.limit);
  const [items, total] = await Promise.all([
    Food.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Food.countDocuments(filter),
  ]);
  return paginated(items.map(toFoodDTO), total, query.page, query.limit);
}

export async function getFood(id: string) {
  const food = await Food.findById(id).lean();
  if (!food) throw HttpError.notFound("Food");
  return toFoodDTO(food);
}

export async function createFood(req: Request, input: CreateFoodInput) {
  const data = foodDocumentSchema.parse(input);
  await assertUnique(data);
  const food = await Food.create({
    ...data,
    brand: data.brand ?? null,
    barcode: data.barcode ?? null,
    sourceReference: data.sourceReference ?? null,
    dedupeKey: dedupeKeyOf(data),
    createdBy: req.auth!.userId,
    updatedBy: req.auth!.userId,
  });
  await recordAudit(req, {
    action: "FOOD_CREATED",
    entityType: "FOOD",
    entityId: idOf(food._id),
    summary: `Created food ${food.name}${food.brand ? ` (${food.brand})` : ""}`,
  });
  return toFoodDTO(food.toObject());
}

/**
 * Correcting a food's nutrition affects only future logs: every food log stores its
 * own nutrition snapshot, so past intake never changes silently.
 */
export async function updateFood(req: Request, id: string, input: UpdateFoodInput) {
  const food = await Food.findById(id);
  if (!food) throw HttpError.notFound("Food");
  const current = toFoodDTO(food.toObject());

  // Re-validate cross-field rules (brand vs kind, macro totals) on the merged document.
  const merged = {
    name: current.name,
    kind: current.kind,
    brand: current.brand,
    barcode: current.barcode,
    category: current.category,
    preparation: current.preparation,
    servingBasis: current.servingBasis,
    servingUnit: current.servingUnit,
    servingSizes: current.servingSizes,
    nutrition: current.nutrition,
    source: current.source,
    sourceReference: current.sourceReference,
    ...input,
  };
  const parsed = foodDocumentSchema.safeParse(merged);
  if (!parsed.success) throw HttpError.validation(zodDetails(parsed.error));
  const data = parsed.data;
  await assertUnique(data, id);

  const before = JSON.parse(JSON.stringify(food.toObject()));
  food.set({
    ...data,
    brand: data.brand ?? null,
    barcode: data.barcode ?? null,
    sourceReference: data.sourceReference ?? null,
    dedupeKey: dedupeKeyOf(data),
    updatedBy: req.auth!.userId,
  });
  await food.save();
  await recordAudit(req, {
    action: "FOOD_UPDATED",
    entityType: "FOOD",
    entityId: id,
    summary: `Updated food ${food.name}`,
    changes: diff(before, JSON.parse(JSON.stringify(food.toObject())), ["updatedAt", "createdAt", "__v", "_id", "updatedBy", "dedupeKey"]),
  });
  return toFoodDTO(food.toObject());
}

export async function setFoodStatus(req: Request, id: string, status: "ACTIVE" | "ARCHIVED") {
  const food = await Food.findById(id);
  if (!food) throw HttpError.notFound("Food");
  if (food.status !== status) {
    const from = food.status;
    food.status = status;
    food.archivedAt = status === "ARCHIVED" ? new Date() : null;
    food.updatedBy = toObjectId(req.auth!.userId);
    await food.save();
    await recordAudit(req, {
      action: status === "ARCHIVED" ? "FOOD_ARCHIVED" : "FOOD_RESTORED",
      entityType: "FOOD",
      entityId: id,
      summary: `${status === "ARCHIVED" ? "Archived" : "Restored"} food ${food.name}`,
      changes: { status: { from, to: status } },
    });
  }
  return toFoodDTO(food.toObject());
}

export async function foodUsage(id: string) {
  const [foodLogs, mealTemplates] = await Promise.all([
    FoodLog.countDocuments({ foodId: id }),
    MealTemplate.countDocuments({ "ingredients.foodId": id }),
  ]);
  return { foodLogs, mealTemplates, inUse: foodLogs + mealTemplates > 0 };
}

export async function deleteFood(req: Request, id: string) {
  const food = await Food.findById(id);
  if (!food) throw HttpError.notFound("Food");
  if ((await foodUsage(id)).inUse) {
    throw HttpError.conflict("This food is used in food logs or meal templates. Archive it instead.", "FOOD_IN_USE");
  }
  await food.deleteOne();
  await recordAudit(req, {
    action: "FOOD_DELETED",
    entityType: "FOOD",
    entityId: id,
    summary: `Deleted unused food ${food.name}`,
  });
}
