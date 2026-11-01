import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, objectIdSchema, paginationQuerySchema, type AdminDashboardDTO } from "@recomptrack/shared";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { HttpError } from "../../utils/httpError";
import { paginate, paginated } from "../../utils/pagination";
import { idOf } from "../../utils/serialize";
import { AuditLog } from "../audit/auditLog.model";
import { toAuditDTO } from "../audit/audit.service";
import { Exercise } from "../exercises/exercise.model";
import { BodyMeasurement } from "../measurements/bodyMeasurement.model";
import { Food } from "../nutrition/food.model";
import { FoodLog } from "../nutrition/nutrition.models";
import { User } from "../users/user.model";
import { WorkoutPlan, WorkoutSession } from "../workouts/workout.models";

export const adminRouter = Router();

const DAY = 24 * 60 * 60 * 1000;
const dashboardQuery = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

/** Platform overview. Aggregate counts only — no individual user's health data. */
adminRouter.get(
  "/dashboard",
  authorize(PERMISSIONS.ADMIN_DASHBOARD_READ),
  validate({ query: dashboardQuery }),
  async (req, res) => {
    const to = req.valid.query.to ? new Date(req.valid.query.to) : new Date();
    const from = req.valid.query.from ? new Date(req.valid.query.from) : new Date(to.getTime() - 7 * DAY);
    if (from > to) throw HttpError.validation([{ path: "from", message: "'from' must be before 'to'" }]);
    const range = { $gte: from, $lte: to };

    const [
      totalUsers,
      activeUsers,
      newUsers,
      activeInRange,
      exercises,
      archivedExercises,
      foods,
      archivedFoods,
      activePlans,
      sessions,
      foodLogs,
      measurements,
      latestRegistrations,
      latestAdminChanges,
    ] = await Promise.all([
      User.countDocuments({ role: "USER" }),
      User.countDocuments({ role: "USER", status: "ACTIVE" }),
      User.countDocuments({ role: "USER", createdAt: range }),
      User.countDocuments({ role: "USER", lastLoginAt: range }),
      Exercise.countDocuments({ status: "ACTIVE" }),
      Exercise.countDocuments({ status: "ARCHIVED" }),
      Food.countDocuments({ status: "ACTIVE" }),
      Food.countDocuments({ status: "ARCHIVED" }),
      WorkoutPlan.countDocuments({ status: "PUBLISHED" }),
      WorkoutSession.countDocuments({ status: "COMPLETED", startedAt: range }),
      FoodLog.countDocuments({ createdAt: range }),
      BodyMeasurement.countDocuments({ createdAt: range }),
      User.find({ role: "USER" }).sort({ createdAt: -1 }).limit(5).select({ name: 1, email: 1, createdAt: 1 }).lean(),
      AuditLog.find({ action: { $ne: "USER_VIEWED" } })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("actorId", { name: 1, email: 1 })
        .lean(),
    ]);

    const body: AdminDashboardDTO = {
      range: { from: from.toISOString(), to: to.toISOString() },
      users: { total: totalUsers, active: activeUsers, deactivated: totalUsers - activeUsers, newInRange: newUsers, activeInRange },
      catalogue: { exercises, archivedExercises, foods, archivedFoods },
      plans: { activeWorkoutPlans: activePlans },
      activity: { workoutSessionsInRange: sessions, foodLogsInRange: foodLogs, measurementsInRange: measurements },
      latestRegistrations: latestRegistrations.map((u) => ({
        id: idOf(u._id),
        name: u.name,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
      })),
      latestAdminChanges: latestAdminChanges.map((l) => toAuditDTO(l as never)),
    };
    res.json(body);
  },
);

const auditQuery = paginationQuerySchema.extend({
  entityType: z.string().max(40).optional(),
  entityId: objectIdSchema.optional(),
  actorId: objectIdSchema.optional(),
});

adminRouter.get("/audit-logs", authorize(PERMISSIONS.AUDIT_READ), validate({ query: auditQuery }), async (req, res) => {
  const { page, limit, entityType, entityId, actorId } = req.valid.query;
  const filter: Record<string, unknown> = {};
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (actorId) filter.actorId = actorId;
  const { skip } = paginate(page, limit);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("actorId", { name: 1, email: 1 }).lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json(paginated(items.map((l) => toAuditDTO(l as never)), total, page, limit));
});
