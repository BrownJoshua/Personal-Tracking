import type { AssessmentInput, GoalInput, MeDTO, PreferencesInput, ProfileInput } from "@recomptrack/shared";
import { ROLE_PERMISSIONS } from "@recomptrack/shared";
import { HttpError } from "../../utils/httpError";
import { toObjectId } from "../../utils/serialize";
import { BodyMeasurement } from "../measurements/bodyMeasurement.model";
import { User } from "./user.model";
import { UserGoal } from "./userGoal.model";
import { UserPreference } from "./userPreference.model";
import { UserProfile } from "./userProfile.model";
import { toGoalDTO, toPreferencesDTO, toProfileDTO, toUserDTO } from "./users.serializers";

/** Every function here takes the *authenticated* user id — never one from the request body. */

export async function getMe(userId: string): Promise<MeDTO> {
  const [user, profile, goal, preferences] = await Promise.all([
    User.findById(userId).lean(),
    UserProfile.findOne({ userId }).lean(),
    UserGoal.findOne({ userId, status: "ACTIVE" }).lean(),
    UserPreference.findOne({ userId }).lean(),
  ]);
  if (!user) throw HttpError.notFound("User");
  return {
    user: toUserDTO(user),
    profile: toProfileDTO(profile),
    goal: goal ? toGoalDTO(goal) : null,
    preferences: toPreferencesDTO(preferences),
    permissions: [...(ROLE_PERMISSIONS[user.role] ?? [])],
  };
}

export async function updateMe(userId: string, input: { name?: string }) {
  await User.updateOne({ _id: userId }, { $set: input });
  return getMe(userId);
}

export async function updateProfile(userId: string, input: ProfileInput) {
  await UserProfile.updateOne({ userId }, { $set: input }, { upsert: true });
  return getMe(userId);
}

/** Replace the active goal, keeping the previous one as history. */
async function setGoal(userId: string, input: GoalInput) {
  const now = new Date();
  await UserGoal.updateMany(
    { userId, status: "ACTIVE" },
    { $set: { status: "ENDED", endDate: now } },
  );
  await UserGoal.create({
    userId: toObjectId(userId),
    goalType: input.goalType,
    targetWeightKg: input.targetWeightKg ?? null,
    targetBodyFatPercent: input.targetBodyFatPercent ?? null,
    startDate: now,
    status: "ACTIVE",
  });
}

export async function updateGoal(userId: string, input: GoalInput) {
  await setGoal(userId, input);
  return getMe(userId);
}

export async function updatePreferences(userId: string, input: PreferencesInput) {
  // Flatten nested objects into dotted paths so a partial update never wipes sibling fields.
  const $set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) $set[`${key}.${k}`] = v;
    } else if (value !== undefined) {
      $set[key] = value;
    }
  }
  await UserPreference.updateOne({ userId }, { $set }, { upsert: true });
  return getMe(userId);
}

/**
 * Onboarding personal assessment. Weight / waist / body-fat are stored as the first
 * body measurement (not on the profile) so they become part of the user's history.
 */
export async function submitAssessment(userId: string, input: AssessmentInput) {
  await UserProfile.updateOne({ userId }, { $set: input.profile }, { upsert: true });

  const measurements: Record<string, number> = {};
  if (input.currentWeightKg !== undefined) measurements.weightKg = input.currentWeightKg;
  if (input.waistCm !== undefined) measurements.waistCm = input.waistCm;
  if (input.bodyFatPercent !== undefined) measurements.bodyFatPercent = input.bodyFatPercent;
  if (Object.keys(measurements).length > 0) {
    await BodyMeasurement.create({ userId, recordedAt: new Date(), measurements, source: "MANUAL", notes: "Initial assessment" });
  }
  if (input.goal) await setGoal(userId, input.goal);

  await User.updateOne({ _id: userId }, { $set: { onboardingCompleted: true } });
  return getMe(userId);
}
