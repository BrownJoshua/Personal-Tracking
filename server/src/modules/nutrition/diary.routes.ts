import { Router } from "express";
import { z } from "zod";
import {
  PERMISSIONS,
  createFoodLogSchema,
  customFoodSchema,
  diaryQuerySchema,
  historyQuerySchema,
  logMealSchema,
  objectIdSchema,
  saveMealFromDiarySchema,
  savedMealSchema,
  updateFoodLogSchema,
} from "@recomptrack/shared";
import { requireAuth } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { userTargetsRouter } from "../targets/targets.routes";
import * as diary from "./diary.service";

/** /api/nutrition — the signed-in user's own diary, foods and meals. */
export const nutritionRouter = Router();
const read = authorize(PERMISSIONS.OWN_RECORDS_READ);
const write = authorize(PERMISSIONS.OWN_RECORDS_WRITE);
const idParams = z.object({ id: objectIdSchema });
const uid = (req: Express.Request) => requireAuth(req).userId;

nutritionRouter.use("/targets", userTargetsRouter);

nutritionRouter.get("/diary", read, validate({ query: diaryQuerySchema }), async (req, res) => {
  res.json(await diary.diary(uid(req), req.valid.query.date));
});
nutritionRouter.get("/history", read, validate({ query: historyQuerySchema }), async (req, res) => {
  res.json(await diary.history(uid(req), req.valid.query.from, req.valid.query.to));
});
nutritionRouter.get("/recent-foods", read, async (req, res) => {
  res.json(await diary.recentFoods(uid(req)));
});

nutritionRouter.post("/logs", write, validate({ body: createFoodLogSchema }), async (req, res) => {
  res.status(201).json(await diary.createLog(uid(req), req.valid.body));
});
nutritionRouter.patch("/logs/:id", write, validate({ params: idParams, body: updateFoodLogSchema }), async (req, res) => {
  res.json(await diary.updateLog(uid(req), req.valid.params.id, req.valid.body));
});
nutritionRouter.delete("/logs/:id", write, validate({ params: idParams }), async (req, res) => {
  await diary.deleteLog(uid(req), req.valid.params.id);
  res.status(204).end();
});

nutritionRouter.get("/custom-foods", read, async (req, res) => {
  res.json(await diary.listCustomFoods(uid(req)));
});
nutritionRouter.post("/custom-foods", write, validate({ body: customFoodSchema }), async (req, res) => {
  res.status(201).json(await diary.createCustomFood(uid(req), req.valid.body));
});
nutritionRouter.put("/custom-foods/:id", write, validate({ params: idParams, body: customFoodSchema }), async (req, res) => {
  res.json(await diary.updateCustomFood(uid(req), req.valid.params.id, req.valid.body));
});
nutritionRouter.delete("/custom-foods/:id", write, validate({ params: idParams }), async (req, res) => {
  await diary.deleteCustomFood(uid(req), req.valid.params.id);
  res.status(204).end();
});

nutritionRouter.get("/saved-meals", read, async (req, res) => {
  res.json(await diary.listSavedMeals(uid(req)));
});
nutritionRouter.post("/saved-meals", write, validate({ body: savedMealSchema }), async (req, res) => {
  res.status(201).json(await diary.createSavedMeal(uid(req), req.valid.body));
});
nutritionRouter.post("/saved-meals/from-diary", write, validate({ body: saveMealFromDiarySchema }), async (req, res) => {
  res.status(201).json(await diary.saveMealFromDiary(uid(req), req.valid.body));
});
nutritionRouter.delete("/saved-meals/:id", write, validate({ params: idParams }), async (req, res) => {
  await diary.deleteSavedMeal(uid(req), req.valid.params.id);
  res.status(204).end();
});
nutritionRouter.post("/saved-meals/:id/log", write, validate({ params: idParams, body: logMealSchema }), async (req, res) => {
  res.status(201).json(await diary.logSavedMeal(uid(req), req.valid.params.id, req.valid.body));
});

nutritionRouter.get("/meal-plans", read, async (req, res) => {
  res.json(await diary.assignedMeals(uid(req)));
});
nutritionRouter.post("/meal-plans/:id/log", write, validate({ params: idParams, body: logMealSchema }), async (req, res) => {
  res.status(201).json(await diary.logAssignedMeal(uid(req), req.valid.params.id, req.valid.body));
});
