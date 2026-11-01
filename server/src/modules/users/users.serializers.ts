import type { GoalDTO, PreferencesDTO, ProfileDTO, UserDTO } from "@recomptrack/shared";
import { idOf, iso } from "../../utils/serialize";
import type { IUser } from "./user.model";
import type { IUserGoal } from "./userGoal.model";
import type { IUserPreference } from "./userPreference.model";
import type { IUserProfile } from "./userProfile.model";

export function toUserDTO(u: Pick<IUser, "_id" | "name" | "email" | "role" | "status" | "onboardingCompleted" | "createdAt" | "lastLoginAt">): UserDTO {
  return {
    id: idOf(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    onboardingCompleted: u.onboardingCompleted ?? false,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: iso(u.lastLoginAt),
  };
}

export function toProfileDTO(p: IUserProfile | null): ProfileDTO {
  return {
    dateOfBirth: p?.dateOfBirth ?? null,
    heightCm: p?.heightCm ?? null,
    sex: p?.sex ?? null,
    activityLevel: p?.activityLevel ?? null,
    trainingExperience: p?.trainingExperience ?? null,
    updatedAt: iso(p?.updatedAt),
  };
}

export function toGoalDTO(g: IUserGoal): GoalDTO {
  return {
    id: idOf(g._id),
    goalType: g.goalType,
    targetWeightKg: g.targetWeightKg,
    targetBodyFatPercent: g.targetBodyFatPercent,
    startDate: g.startDate.toISOString(),
    endDate: iso(g.endDate),
    status: g.status,
  };
}

export function toPreferencesDTO(p: IUserPreference | null): PreferencesDTO {
  return {
    units: p?.units ?? "METRIC",
    timezone: p?.timezone ?? "UTC",
    notifications: {
      workoutReminders: p?.notifications?.workoutReminders ?? true,
      weighInReminders: p?.notifications?.weighInReminders ?? true,
      mealReminders: p?.notifications?.mealReminders ?? false,
    },
    sharing: {
      shareProgressWithAdmin: p?.sharing?.shareProgressWithAdmin ?? false,
      shareNutritionWithAdmin: p?.sharing?.shareNutritionWithAdmin ?? false,
    },
  };
}
