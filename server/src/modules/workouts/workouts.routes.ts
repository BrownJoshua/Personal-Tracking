import { Router } from "express";
import { z } from "zod";
import {
  PERMISSIONS,
  addSessionExerciseSchema,
  objectIdSchema,
  sessionHistoryQuerySchema,
  sessionNotesSchema,
  startSessionSchema,
  updateExerciseLogSchema,
} from "@recomptrack/shared";
import { requireAuth } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as svc from "./sessions.service";

/** /api/workouts — the signed-in user's own plan and sessions only. */
export const workoutsRouter = Router();

const read = authorize(PERMISSIONS.OWN_RECORDS_READ);
const write = authorize(PERMISSIONS.OWN_RECORDS_WRITE);
const sessionParams = z.object({ id: objectIdSchema });
const logParams = z.object({ id: objectIdSchema, logId: objectIdSchema });

workoutsRouter.get("/plan", read, async (req, res) => {
  res.json(await svc.currentPlan(requireAuth(req).userId));
});
workoutsRouter.get("/today", read, async (req, res) => {
  res.json(await svc.today(requireAuth(req).userId));
});

workoutsRouter.get("/sessions", read, validate({ query: sessionHistoryQuerySchema }), async (req, res) => {
  const { page, limit, exerciseId } = req.valid.query;
  res.json(await svc.history(requireAuth(req).userId, page, limit, exerciseId));
});
workoutsRouter.get("/sessions/active", read, async (req, res) => {
  res.json(await svc.activeSession(requireAuth(req).userId));
});
workoutsRouter.post("/sessions", write, validate({ body: startSessionSchema }), async (req, res) => {
  res.status(201).json(await svc.startSession(requireAuth(req).userId, req.valid.body));
});
workoutsRouter.get("/sessions/:id", read, validate({ params: sessionParams }), async (req, res) => {
  res.json(await svc.getSession(requireAuth(req).userId, req.valid.params.id));
});
workoutsRouter.patch("/sessions/:id", write, validate({ params: sessionParams, body: sessionNotesSchema }), async (req, res) => {
  res.json(await svc.setNotes(requireAuth(req).userId, req.valid.params.id, req.valid.body.notes ?? null));
});
for (const action of ["pause", "resume", "complete"] as const) {
  workoutsRouter.post(`/sessions/:id/${action}`, write, validate({ params: sessionParams }), async (req, res) => {
    res.json(await svc[action](requireAuth(req).userId, req.valid.params.id));
  });
}
workoutsRouter.post("/sessions/:id/discard", write, validate({ params: sessionParams }), async (req, res) => {
  await svc.discard(requireAuth(req).userId, req.valid.params.id);
  res.status(204).end();
});

workoutsRouter.post("/sessions/:id/exercises", write, validate({ params: sessionParams, body: addSessionExerciseSchema }), async (req, res) => {
  res.status(201).json(await svc.addExercise(requireAuth(req).userId, req.valid.params.id, req.valid.body.exerciseId));
});
workoutsRouter.put("/sessions/:id/exercises/:logId", write, validate({ params: logParams, body: updateExerciseLogSchema }), async (req, res) => {
  res.json(await svc.updateExerciseLog(requireAuth(req).userId, req.valid.params.id, req.valid.params.logId, req.valid.body));
});
workoutsRouter.delete("/sessions/:id/exercises/:logId", write, validate({ params: logParams }), async (req, res) => {
  res.json(await svc.removeExercise(requireAuth(req).userId, req.valid.params.id, req.valid.params.logId));
});
