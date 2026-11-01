import { Router } from "express";
import { PERMISSIONS, assessmentSchema, goalSchema, preferencesSchema, profileSchema, updateMeSchema } from "@recomptrack/shared";
import { requireAuth } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as users from "./users.service";

/** Mounted at /api/users, after `authenticate`. Only "me" routes: no user id is ever accepted. */
export const usersRouter = Router();

usersRouter.get("/me", authorize(PERMISSIONS.OWN_PROFILE_READ), async (req, res) => {
  res.json(await users.getMe(requireAuth(req).userId));
});

usersRouter.patch("/me", authorize(PERMISSIONS.OWN_PROFILE_WRITE), validate({ body: updateMeSchema }), async (req, res) => {
  res.json(await users.updateMe(requireAuth(req).userId, req.valid.body));
});

usersRouter.put(
  "/me/profile",
  authorize(PERMISSIONS.OWN_PROFILE_WRITE),
  validate({ body: profileSchema }),
  async (req, res) => {
    res.json(await users.updateProfile(requireAuth(req).userId, req.valid.body));
  },
);

usersRouter.post(
  "/me/assessment",
  authorize(PERMISSIONS.OWN_PROFILE_WRITE),
  validate({ body: assessmentSchema }),
  async (req, res) => {
    res.json(await users.submitAssessment(requireAuth(req).userId, req.valid.body));
  },
);

usersRouter.put("/me/goal", authorize(PERMISSIONS.OWN_PROFILE_WRITE), validate({ body: goalSchema }), async (req, res) => {
  res.json(await users.updateGoal(requireAuth(req).userId, req.valid.body));
});

usersRouter.patch(
  "/me/preferences",
  authorize(PERMISSIONS.OWN_PROFILE_WRITE),
  validate({ body: preferencesSchema }),
  async (req, res) => {
    res.json(await users.updatePreferences(requireAuth(req).userId, req.valid.body));
  },
);
