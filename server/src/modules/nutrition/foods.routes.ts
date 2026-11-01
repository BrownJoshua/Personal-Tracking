import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, createFoodSchema, foodListQuerySchema, objectIdSchema, updateFoodSchema } from "@recomptrack/shared";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as svc from "./foods.service";

const idParams = z.object({ id: objectIdSchema });

/** User-facing food search. Mounted at /api/foods. */
export const foodsRouter = Router();
foodsRouter.use(authorize(PERMISSIONS.CATALOGUE_READ));

foodsRouter.get("/", validate({ query: foodListQuerySchema }), async (req, res) => {
  res.json(await svc.listFoods(req.valid.query, { activeOnly: true }));
});

foodsRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  res.json(await svc.getFood(req.valid.params.id));
});

/** Mounted at /api/admin/foods. */
export const adminFoodsRouter = Router();
adminFoodsRouter.use(authorize(PERMISSIONS.FOODS_MANAGE));

adminFoodsRouter.get("/", validate({ query: foodListQuerySchema }), async (req, res) => {
  res.json(await svc.listFoods(req.valid.query, { activeOnly: false }));
});

adminFoodsRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  const [food, usage] = await Promise.all([svc.getFood(req.valid.params.id), svc.foodUsage(req.valid.params.id)]);
  res.json({ ...food, usage });
});

adminFoodsRouter.post("/", validate({ body: createFoodSchema }), async (req, res) => {
  res.status(201).json(await svc.createFood(req, req.valid.body));
});

adminFoodsRouter.patch("/:id", validate({ params: idParams, body: updateFoodSchema }), async (req, res) => {
  res.json(await svc.updateFood(req, req.valid.params.id, req.valid.body));
});

adminFoodsRouter.post("/:id/archive", validate({ params: idParams }), async (req, res) => {
  res.json(await svc.setFoodStatus(req, req.valid.params.id, "ARCHIVED"));
});

adminFoodsRouter.post("/:id/restore", validate({ params: idParams }), async (req, res) => {
  res.json(await svc.setFoodStatus(req, req.valid.params.id, "ACTIVE"));
});

adminFoodsRouter.delete("/:id", validate({ params: idParams }), async (req, res) => {
  await svc.deleteFood(req, req.valid.params.id);
  res.status(204).end();
});
