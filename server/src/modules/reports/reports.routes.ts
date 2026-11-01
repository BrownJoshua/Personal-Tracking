import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, isoDateSchema, objectIdSchema } from "@recomptrack/shared";
import { requireAuth } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as reports from "./reports.service";

/** /api/reports — analytics over the signed-in user's own records. */
export const reportsRouter = Router();
reportsRouter.use(authorize(PERMISSIONS.OWN_RECORDS_READ));

const daysQuery = (def: number, max: number) => z.object({ days: z.coerce.number().int().min(7).max(max).default(def) });

reportsRouter.get("/body", validate({ query: daysQuery(90, 730) }), async (req, res) => {
  res.json(await reports.bodyTrend(requireAuth(req).userId, req.valid.query.days));
});
reportsRouter.get("/strength", async (req, res) => {
  res.json(await reports.strengthSummary(requireAuth(req).userId));
});
reportsRouter.get(
  "/strength/:exerciseId",
  validate({ params: z.object({ exerciseId: objectIdSchema }), query: daysQuery(180, 730) }),
  async (req, res) => {
    res.json(await reports.strengthSeries(requireAuth(req).userId, req.valid.params.exerciseId, req.valid.query.days));
  },
);
reportsRouter.get("/training", validate({ query: z.object({ weeks: z.coerce.number().int().min(1).max(52).default(8) }) }), async (req, res) => {
  res.json(await reports.trainingWeeks(requireAuth(req).userId, req.valid.query.weeks));
});
reportsRouter.get("/weekly", validate({ query: z.object({ week: isoDateSchema.optional() }) }), async (req, res) => {
  res.json(await reports.weeklyReport(requireAuth(req).userId, req.valid.query.week));
});
