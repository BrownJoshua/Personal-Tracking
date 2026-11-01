import type { Request } from "express";
import { scaleNutrition, sumNutrition, type MealTemplateDTO, type MealTemplateInput } from "@recomptrack/shared";
import { HttpError } from "../../utils/httpError";
import { paginate, paginated } from "../../utils/pagination";
import { idOf, toObjectId } from "../../utils/serialize";
import { containsRegex } from "../../utils/text";
import { recordAudit } from "../audit/audit.service";
import { User } from "../users/user.model";
import { Food } from "./food.model";
import { toFoodDTO } from "./foods.service";
import { FoodLog, MealTemplate, UserMealAssignment, type IMealTemplate } from "./nutrition.models";

const unitOf = (u: string) => (u === "MILLILITRE" ? "ml" : "g") as "g" | "ml";

export async function toTemplateDTOs(templates: IMealTemplate[], withCounts = false): Promise<MealTemplateDTO[]> {
  const foods = await Food.find({ _id: { $in: templates.flatMap((t) => t.ingredients.map((i) => i.foodId)) } }).lean();
  const foodMap = new Map(foods.map((f) => [idOf(f._id), toFoodDTO(f)]));
  const counts = withCounts
    ? new Map(
        (
          await UserMealAssignment.aggregate<{ _id: unknown; n: number }>([
            { $match: { status: "ACTIVE", mealTemplateId: { $in: templates.map((t) => t._id) } } },
            { $group: { _id: "$mealTemplateId", n: { $sum: 1 } } },
          ])
        ).map((c) => [idOf(c._id), c.n]),
      )
    : null;
  return templates.map((t) => {
    const ingredients = t.ingredients.map((i) => {
      const f = foodMap.get(idOf(i.foodId));
      return {
        foodId: idOf(i.foodId),
        name: f?.name ?? i.foodNameSnapshot,
        brand: f?.brand ?? null,
        preparation: f?.preparation ?? null,
        quantity: i.quantity,
        unit: unitOf(f?.servingUnit ?? "GRAM"),
        nutrition: f ? scaleNutrition(f.nutrition, f.servingBasis, i.quantity) : { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fibre: 0, sugar: null, saturatedFat: null, sodiumMg: null },
        foodStatus: f?.status ?? ("ARCHIVED" as const),
      };
    });
    return {
      id: idOf(t._id),
      name: t.name,
      description: t.description,
      mealType: t.mealType,
      tags: t.tags,
      ingredients,
      totalNutrition: sumNutrition(ingredients.map((i) => i.nutrition)),
      status: t.status,
      ...(counts ? { activeAssignments: counts.get(idOf(t._id)) ?? 0 } : {}),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  });
}

export async function getTemplate(id: string) {
  const t = await MealTemplate.findById(id).lean();
  if (!t) throw HttpError.notFound("Meal template");
  return (await toTemplateDTOs([t], true))[0]!;
}

export async function listTemplates(q: { q?: string; status?: string; mealType?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = {};
  if (q.status && q.status !== "ALL") filter.status = q.status;
  if (q.mealType) filter.mealType = q.mealType;
  if (q.q) filter.name = containsRegex(q.q);
  const { skip, limit } = paginate(q.page, q.limit);
  const [items, total] = await Promise.all([
    MealTemplate.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    MealTemplate.countDocuments(filter),
  ]);
  return paginated(await toTemplateDTOs(items, true), total, q.page, q.limit);
}

/** Totals are always derived from the ingredients' food records — never typed in. */
async function resolveIngredients(ingredients: { foodId: string; quantity: number }[]) {
  const foods = await Food.find({ _id: { $in: ingredients.map((i) => i.foodId) }, status: "ACTIVE" }).lean();
  const map = new Map(foods.map((f) => [idOf(f._id), f]));
  const missing = ingredients.filter((i) => !map.has(i.foodId));
  if (missing.length) throw HttpError.validation([{ path: "ingredients", message: `${missing.length} food(s) are archived or no longer exist` }]);
  const resolved = ingredients.map((i) => {
    const f = map.get(i.foodId)!;
    return { foodId: f._id, foodNameSnapshot: f.name, quantity: i.quantity, nutrition: scaleNutrition(toFoodDTO(f).nutrition, f.servingBasis, i.quantity) };
  });
  return {
    ingredients: resolved.map(({ nutrition: _n, ...rest }) => rest),
    totalNutrition: sumNutrition(resolved.map((r) => r.nutrition)),
  };
}

type Parsed = { name: string; description?: string | null; mealType: IMealTemplate["mealType"]; tags: string[]; ingredients: { foodId: string; quantity: number }[] };

export async function createTemplate(req: Request, input: Parsed) {
  const { ingredients, totalNutrition } = await resolveIngredients(input.ingredients);
  const t = await MealTemplate.create({
    name: input.name,
    description: input.description ?? null,
    mealType: input.mealType,
    tags: input.tags,
    ingredients,
    totalNutrition,
    status: "DRAFT",
    createdBy: req.auth!.userId,
  });
  await recordAudit(req, { action: "MEAL_TEMPLATE_CREATED", entityType: "MEAL_TEMPLATE", entityId: idOf(t._id), summary: `Created meal template ${t.name}` });
  return getTemplate(idOf(t._id));
}

/** Editing is allowed while not archived; logged meals keep their own snapshots. */
export async function updateTemplate(req: Request, id: string, input: Parsed) {
  const t = await MealTemplate.findById(id);
  if (!t) throw HttpError.notFound("Meal template");
  if (t.status === "ARCHIVED") throw HttpError.conflict("Restore the template before editing it", "TEMPLATE_ARCHIVED");
  const { ingredients, totalNutrition } = await resolveIngredients(input.ingredients);
  const before = { calories: t.totalNutrition.calories, ingredients: t.ingredients.length };
  t.set({ name: input.name, description: input.description ?? null, mealType: input.mealType, tags: input.tags, ingredients, totalNutrition });
  await t.save();
  await recordAudit(req, {
    action: "MEAL_TEMPLATE_UPDATED",
    entityType: "MEAL_TEMPLATE",
    entityId: id,
    summary: `Updated meal template ${t.name}`,
    changes: { calories: { from: before.calories, to: totalNutrition.calories }, ingredients: { from: before.ingredients, to: ingredients.length } },
  });
  return getTemplate(id);
}

export async function setTemplateStatus(req: Request, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  const t = await MealTemplate.findById(id);
  if (!t) throw HttpError.notFound("Meal template");
  if (status === "PUBLISHED") {
    const active = await Food.countDocuments({ _id: { $in: t.ingredients.map((i) => i.foodId) }, status: "ACTIVE" });
    if (active !== new Set(t.ingredients.map((i) => idOf(i.foodId))).size) {
      throw HttpError.validation([{ path: "ingredients", message: "Replace archived foods before publishing" }]);
    }
  }
  const from = t.status;
  t.status = status;
  await t.save();
  if (status === "ARCHIVED") {
    await UserMealAssignment.updateMany({ mealTemplateId: t._id, status: "ACTIVE" }, { $set: { status: "ENDED", endDate: new Date() } });
  }
  await recordAudit(req, {
    action: `MEAL_TEMPLATE_${status === "PUBLISHED" ? "PUBLISHED" : status === "ARCHIVED" ? "ARCHIVED" : "UNPUBLISHED"}`,
    entityType: "MEAL_TEMPLATE",
    entityId: id,
    summary: `${status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Moved to draft"} meal template ${t.name}`,
    changes: { status: { from, to: status } },
  });
  return getTemplate(id);
}

export async function deleteTemplate(req: Request, id: string) {
  const t = await MealTemplate.findById(id);
  if (!t) throw HttpError.notFound("Meal template");
  const [logs, assignments] = await Promise.all([FoodLog.countDocuments({ mealTemplateId: t._id }), UserMealAssignment.countDocuments({ mealTemplateId: t._id })]);
  if (logs + assignments > 0) throw HttpError.conflict("This template has been assigned or logged. Archive it instead.", "TEMPLATE_IN_USE");
  await t.deleteOne();
  await recordAudit(req, { action: "MEAL_TEMPLATE_DELETED", entityType: "MEAL_TEMPLATE", entityId: id, summary: `Deleted meal template ${t.name}` });
}

export async function assignTemplate(req: Request, input: { userId: string; mealTemplateId: string; startDate: string }) {
  const [user, t] = await Promise.all([User.findById(input.userId).lean(), MealTemplate.findById(input.mealTemplateId).lean()]);
  if (!user) throw HttpError.notFound("User");
  if (user.status !== "ACTIVE") throw HttpError.conflict("This account is deactivated", "USER_INACTIVE");
  if (!t) throw HttpError.notFound("Meal template");
  if (t.status !== "PUBLISHED") throw HttpError.conflict("Only published templates can be assigned", "TEMPLATE_NOT_PUBLISHED");
  if (await UserMealAssignment.exists({ userId: user._id, mealTemplateId: t._id, status: "ACTIVE" })) {
    throw HttpError.conflict("This meal is already assigned to the user", "ALREADY_ASSIGNED");
  }
  const a = await UserMealAssignment.create({
    userId: user._id,
    mealTemplateId: t._id,
    startDate: new Date(`${input.startDate}T00:00:00Z`),
    status: "ACTIVE",
    assignedBy: toObjectId(req.auth!.userId),
  });
  await recordAudit(req, { action: "MEAL_TEMPLATE_ASSIGNED", entityType: "USER", entityId: input.userId, summary: `Assigned meal ${t.name} to ${user.email}` });
  return { id: idOf(a._id), mealTemplateId: idOf(t._id), name: t.name, mealType: t.mealType, startDate: a.startDate.toISOString(), status: a.status };
}

export async function endMealAssignment(req: Request, id: string) {
  const a = await UserMealAssignment.findById(id);
  if (!a) throw HttpError.notFound("Assignment");
  if (a.status !== "ACTIVE") throw HttpError.conflict("This assignment has already ended", "ASSIGNMENT_ENDED");
  a.status = "ENDED";
  a.endDate = new Date();
  await a.save();
  await recordAudit(req, { action: "MEAL_ASSIGNMENT_ENDED", entityType: "USER", entityId: idOf(a.userId), summary: "Ended meal assignment" });
}
