import { Router } from "express";
import { z } from "zod";
import {
  PERMISSIONS,
  adminUpdateUserSchema,
  adminUserListQuerySchema,
  objectIdSchema,
  type AdminUserDetailDTO,
} from "@recomptrack/shared";
import { requireAuth } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { HttpError } from "../../utils/httpError";
import { paginate, paginated } from "../../utils/pagination";
import { containsRegex } from "../../utils/text";
import { revokeAllSessions } from "../auth/auth.service";
import { recordAudit } from "../audit/audit.service";
import { User } from "./user.model";
import { UserGoal } from "./userGoal.model";
import { UserPreference } from "./userPreference.model";
import { UserProfile } from "./userProfile.model";
import { toPreferencesDTO, toUserDTO } from "./users.serializers";
import { manualTargetSchema, type AdminUserPlansDTO } from "@recomptrack/shared";
import { idOf } from "../../utils/serialize";
import { UserMealAssignment, MealTemplate } from "../nutrition/nutrition.models";
import { currentTarget, recalculate, setManualTarget, toTargetDTO } from "../targets/targets.service";
import { toAssignmentDTOs } from "../workouts/plans.service";
import { UserWorkoutAssignment } from "../workouts/workout.models";

export const adminUsersRouter = Router();
adminUsersRouter.use(authorize(PERMISSIONS.USERS_MANAGE));

const idParams = z.object({ id: objectIdSchema });

adminUsersRouter.get("/", validate({ query: adminUserListQuerySchema }), async (req, res) => {
  const { q, role, status, page, limit } = req.valid.query;
  const filter: Record<string, unknown> = {};
  if (q) filter.$or = [{ name: containsRegex(q) }, { email: containsRegex(q) }];
  if (role) filter.role = role;
  if (status) filter.status = status;
  const { skip } = paginate(page, limit);
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json(paginated(items.map(toUserDTO), total, page, limit));
});

/**
 * Admin view of a user. Deliberately minimal: no date of birth, height, sex,
 * measurements or food logs. Personal records will only be exposed when the user
 * has opted in via `sharing` (Phase 4 reports). Every view is audited.
 */
adminUsersRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  const { id } = req.valid.params;
  const user = await User.findById(id).lean();
  if (!user) throw HttpError.notFound("User");
  const [profile, goal, prefs] = await Promise.all([
    UserProfile.findOne({ userId: id }).select({ activityLevel: 1, trainingExperience: 1 }).lean(),
    UserGoal.findOne({ userId: id, status: "ACTIVE" }).select({ goalType: 1, startDate: 1 }).lean(),
    UserPreference.findOne({ userId: id }).select({ sharing: 1 }).lean(),
  ]);
  await recordAudit(req, {
    action: "USER_VIEWED",
    entityType: "USER",
    entityId: id,
    summary: `Viewed account of ${user.email}`,
  });
  const body: AdminUserDetailDTO = {
    user: toUserDTO(user),
    profile: { activityLevel: profile?.activityLevel ?? null, trainingExperience: profile?.trainingExperience ?? null },
    goal: goal ? { goalType: goal.goalType, startDate: goal.startDate.toISOString() } : null,
    sharing: toPreferencesDTO(prefs as never).sharing,
  };
  res.json(body);
});

adminUsersRouter.patch("/:id", validate({ params: idParams, body: adminUpdateUserSchema }), async (req, res) => {
  const { id } = req.valid.params;
  const patch = req.valid.body as { status?: "ACTIVE" | "DEACTIVATED"; role?: "ADMIN" | "USER" };
  const me = requireAuth(req);

  if (id === me.userId) {
    throw HttpError.forbidden("You cannot change your own role or status", "SELF_MODIFICATION");
  }
  const user = await User.findById(id);
  if (!user) throw HttpError.notFound("User");

  const removingAdmin =
    user.role === "ADMIN" && user.status === "ACTIVE" && (patch.role === "USER" || patch.status === "DEACTIVATED");
  if (removingAdmin) {
    const otherAdmins = await User.countDocuments({ role: "ADMIN", status: "ACTIVE", _id: { $ne: user._id } });
    if (otherAdmins === 0) throw HttpError.conflict("The last active admin cannot be removed", "LAST_ADMIN");
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (patch.role && patch.role !== user.role) {
    changes.role = { from: user.role, to: patch.role };
    user.role = patch.role;
  }
  if (patch.status && patch.status !== user.status) {
    changes.status = { from: user.status, to: patch.status };
    user.status = patch.status;
  }
  await user.save();

  if (changes.status?.to === "DEACTIVATED" || changes.role) {
    await revokeAllSessions(user._id, changes.status?.to === "DEACTIVATED" ? "ACCOUNT_DEACTIVATED" : "ROLE_CHANGED");
  }
  if (Object.keys(changes).length > 0) {
    const action = changes.status
      ? changes.status.to === "DEACTIVATED"
        ? "USER_DEACTIVATED"
        : "USER_ACTIVATED"
      : "USER_ROLE_CHANGED";
    await recordAudit(req, { action, entityType: "USER", entityId: id, summary: `Updated ${user.email}`, changes });
  }
  res.json(toUserDTO(user));
});

/**
 * Plans and targets for one user. The target breakdown (age, weight) is only included
 * when the user has opted in to sharing progress with admins.
 */
async function userPlans(id: string): Promise<AdminUserPlansDTO> {
  const [assignments, meals, target, prefs] = await Promise.all([
    UserWorkoutAssignment.find({ userId: id }).sort({ createdAt: -1 }).limit(10).lean(),
    UserMealAssignment.find({ userId: id, status: "ACTIVE" }).lean(),
    currentTarget(id),
    UserPreference.findOne({ userId: id }).select({ sharing: 1 }).lean(),
  ]);
  const templates = await MealTemplate.find({ _id: { $in: meals.map((m) => m.mealTemplateId) } }).select({ name: 1, mealType: 1 }).lean();
  const tMap = new Map(templates.map((t) => [idOf(t._id), t]));
  const dtos = await toAssignmentDTOs(assignments);
  return {
    workoutAssignment: dtos.find((a) => a.status === "ACTIVE") ?? null,
    workoutHistory: dtos.filter((a) => a.status !== "ACTIVE"),
    mealAssignments: meals.map((m) => ({
      id: idOf(m._id),
      mealTemplateId: idOf(m.mealTemplateId),
      name: tMap.get(idOf(m.mealTemplateId))?.name ?? "Deleted template",
      mealType: tMap.get(idOf(m.mealTemplateId))?.mealType ?? "SNACK",
      startDate: m.startDate.toISOString(),
      status: m.status,
    })),
    target: target ? toTargetDTO(target, { includeBreakdown: !!prefs?.sharing?.shareProgressWithAdmin }) : null,
  };
}

adminUsersRouter.get("/:id/plans", validate({ params: idParams }), async (req, res) => {
  if (!(await User.exists({ _id: req.valid.params.id }))) throw HttpError.notFound("User");
  res.json(await userPlans(req.valid.params.id));
});

adminUsersRouter.put("/:id/targets", validate({ params: idParams, body: manualTargetSchema }), async (req, res) => {
  if (!(await User.exists({ _id: req.valid.params.id }))) throw HttpError.notFound("User");
  await setManualTarget(req, req.valid.params.id, req.valid.body);
  res.json(await userPlans(req.valid.params.id));
});

/** Drop a manual override and go back to the calculated target. */
adminUsersRouter.post("/:id/targets/recalculate", validate({ params: idParams }), async (req, res) => {
  if (!(await User.exists({ _id: req.valid.params.id }))) throw HttpError.notFound("User");
  const r = await recalculate(req.valid.params.id);
  await recordAudit(req, {
    action: "USER_TARGET_RECALCULATED",
    entityType: "USER",
    entityId: req.valid.params.id,
    summary: r.target ? "Reset nutrition target to the calculated value" : "Target recalculation needs a complete profile",
  });
  if (!r.target) throw HttpError.conflict("The user's profile is incomplete, so targets cannot be calculated yet", "PROFILE_INCOMPLETE");
  res.json(await userPlans(req.valid.params.id));
});
