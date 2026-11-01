import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, exerciseListQuerySchema, objectIdSchema } from "@recomptrack/shared";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { EquipmentType, MuscleGroup } from "./lookup.models";
import * as svc from "./exercises.service";

const idParams = z.object({ id: objectIdSchema });

/** User-facing catalogue: active exercises only. Mounted at /api/exercises. */
export const exercisesRouter = Router();
exercisesRouter.use(authorize(PERMISSIONS.CATALOGUE_READ));

exercisesRouter.get("/", validate({ query: exerciseListQuerySchema }), async (req, res) => {
  res.json(await svc.listExercises(req.valid.query, { activeOnly: true }));
});

// By id, archived exercises remain readable so plans and history that reference them still render.
exercisesRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  res.json(await svc.getExercise(req.valid.params.id, { activeOnly: false }));
});

/** Mounted at /api/lookups. */
export const lookupsRouter = Router();
lookupsRouter.use(authorize(PERMISSIONS.CATALOGUE_READ));

lookupsRouter.get("/muscle-groups", async (_req, res) => {
  const items = await MuscleGroup.find({ status: "ACTIVE" }).sort({ name: 1 }).lean();
  res.json(items.map(svc.toLookupDTO));
});

lookupsRouter.get("/equipment", async (_req, res) => {
  const items = await EquipmentType.find({ status: "ACTIVE" }).sort({ name: 1 }).lean();
  res.json(items.map(svc.toLookupDTO));
});
