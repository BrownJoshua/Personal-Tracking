import { Router } from "express";
import { PERMISSIONS, targetSettingsSchema } from "@recomptrack/shared";
import { requireAuth } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as targets from "./targets.service";

/** User: /api/nutrition/targets */
export const userTargetsRouter = Router();

userTargetsRouter.get("/", authorize(PERMISSIONS.OWN_RECORDS_READ), async (req, res) => {
  res.json(await targets.getStatus(requireAuth(req).userId, { includeBreakdown: true }));
});

userTargetsRouter.post("/recalculate", authorize(PERMISSIONS.OWN_RECORDS_WRITE), async (req, res) => {
  const { userId } = requireAuth(req);
  await targets.recalculate(userId);
  res.json(await targets.getStatus(userId, { includeBreakdown: true }));
});

/** Admin: /api/admin/target-settings */
export const adminTargetSettingsRouter = Router();
adminTargetSettingsRouter.use(authorize(PERMISSIONS.TARGETS_MANAGE));

adminTargetSettingsRouter.get("/", async (_req, res) => {
  res.json(await targets.getSettings());
});

adminTargetSettingsRouter.put("/", validate({ body: targetSettingsSchema }), async (req, res) => {
  res.json(await targets.updateSettings(req, req.valid.body));
});
