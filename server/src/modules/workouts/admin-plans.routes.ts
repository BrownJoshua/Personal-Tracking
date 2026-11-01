import { Router } from "express";
import { z } from "zod";
import { ASSIGNMENT_STATUSES, PERMISSIONS, assignPlanSchema, objectIdSchema, paginationQuerySchema, planListQuerySchema, savePlanSchema } from "@recomptrack/shared";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { paginate, paginated } from "../../utils/pagination";
import * as plans from "./plans.service";
import { UserWorkoutAssignment } from "./workout.models";

const idParams = z.object({ id: objectIdSchema });

/** /api/admin/workout-plans */
export const adminPlansRouter = Router();
adminPlansRouter.use(authorize(PERMISSIONS.WORKOUT_PLANS_MANAGE));

adminPlansRouter.get("/", validate({ query: planListQuerySchema }), async (req, res) => {
  res.json(await plans.listPlans(req.valid.query));
});
adminPlansRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  res.json(await plans.getPlanDTO(req.valid.params.id));
});
adminPlansRouter.post("/", validate({ body: savePlanSchema }), async (req, res) => {
  res.status(201).json(await plans.createPlan(req, req.valid.body));
});
adminPlansRouter.put("/:id", validate({ params: idParams, body: savePlanSchema }), async (req, res) => {
  res.json(await plans.updateDraft(req, req.valid.params.id, req.valid.body));
});
adminPlansRouter.post("/:id/publish", validate({ params: idParams }), async (req, res) => {
  res.json(await plans.publishPlan(req, req.valid.params.id));
});
adminPlansRouter.post("/:id/revise", validate({ params: idParams }), async (req, res) => {
  res.status(201).json(await plans.revisePlan(req, req.valid.params.id));
});
adminPlansRouter.post("/:id/duplicate", validate({ params: idParams }), async (req, res) => {
  res.status(201).json(await plans.duplicatePlan(req, req.valid.params.id));
});
adminPlansRouter.post("/:id/archive", validate({ params: idParams }), async (req, res) => {
  res.json(await plans.archivePlan(req, req.valid.params.id));
});
adminPlansRouter.delete("/:id", validate({ params: idParams }), async (req, res) => {
  await plans.deleteDraft(req, req.valid.params.id);
  res.status(204).end();
});

/** /api/admin/assignments */
export const adminAssignmentsRouter = Router();
adminAssignmentsRouter.use(authorize(PERMISSIONS.WORKOUT_PLANS_MANAGE));

const assignmentQuery = paginationQuerySchema.extend({
  userId: objectIdSchema.optional(),
  workoutPlanId: objectIdSchema.optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
});

adminAssignmentsRouter.get("/", validate({ query: assignmentQuery }), async (req, res) => {
  const { page, limit, userId, workoutPlanId, status } = req.valid.query;
  const filter: Record<string, unknown> = {};
  if (userId) filter.userId = userId;
  if (workoutPlanId) filter.workoutPlanId = workoutPlanId;
  if (status) filter.status = status;
  const { skip } = paginate(page, limit);
  const [rows, total] = await Promise.all([
    UserWorkoutAssignment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserWorkoutAssignment.countDocuments(filter),
  ]);
  res.json(paginated(await plans.toAssignmentDTOs(rows, { withUser: true }), total, page, limit));
});
adminAssignmentsRouter.post("/", validate({ body: assignPlanSchema }), async (req, res) => {
  res.status(201).json(await plans.assignPlan(req, req.valid.body));
});
adminAssignmentsRouter.post("/:id/end", validate({ params: idParams }), async (req, res) => {
  res.json(await plans.endAssignment(req, req.valid.params.id));
});
