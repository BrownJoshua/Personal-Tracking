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
