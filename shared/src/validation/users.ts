import { z } from "zod";
import {
  ACTIVITY_LEVELS,
  ENABLED_ROLES,
  EXPERIENCE_LEVELS,
  GOAL_TYPES,
  SEXES,
  UNIT_SYSTEMS,
  USER_STATUSES,
} from "../constants";
import { isoDateSchema, searchQuerySchema, text } from "./common";

const MIN_AGE_YEARS = 13;

/** Personal assessment / profile. Every field optional so it can be filled in gradually. */
export const profileSchema = z
  .object({
    dateOfBirth: isoDateSchema
      .refine((d) => {
        const dob = new Date(`${d}T00:00:00Z`);
        const cutoff = new Date();
        cutoff.setUTCFullYear(cutoff.getUTCFullYear() - MIN_AGE_YEARS);
        return dob <= cutoff && dob.getUTCFullYear() >= 1900;
      }, `You must be at least ${MIN_AGE_YEARS} years old`)
      .nullable(),
    heightCm: z.number().min(100).max(250).nullable(),
    sex: z.enum(SEXES).nullable(),
    activityLevel: z.enum(ACTIVITY_LEVELS).nullable(),
    trainingExperience: z.enum(EXPERIENCE_LEVELS).nullable(),
  })
  .partial()
  .strict();
export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Onboarding assessment. Body values (weight, waist, body fat) are *not* stored on
 * the profile: they become the user's first body measurement so history is kept.
 */
export const assessmentSchema = z
  .object({
    profile: profileSchema,
    currentWeightKg: z.number().min(25).max(400).optional(),
    waistCm: z.number().min(30).max(250).optional(),
    bodyFatPercent: z.number().min(2).max(70).optional(),
    goal: z
      .object({
        goalType: z.enum(GOAL_TYPES),
        targetWeightKg: z.number().min(25).max(400).nullable().optional(),
        targetBodyFatPercent: z.number().min(2).max(70).nullable().optional(),
      })
      .optional(),
  })
  .strict();
export type AssessmentInput = z.infer<typeof assessmentSchema>;

export const goalSchema = z
  .object({
    goalType: z.enum(GOAL_TYPES),
    targetWeightKg: z.number().min(25).max(400).nullable().optional(),
    targetBodyFatPercent: z.number().min(2).max(70).nullable().optional(),
  })
  .strict();
export type GoalInput = z.infer<typeof goalSchema>;

export const preferencesSchema = z
  .object({
    units: z.enum(UNIT_SYSTEMS),
    timezone: z
      .string()
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Unknown time zone"),
    notifications: z
      .object({
        workoutReminders: z.boolean(),
        weighInReminders: z.boolean(),
        mealReminders: z.boolean(),
      })
      .partial(),
    /** Users decide what an admin (and later a trainer) may see. Defaults to nothing. */
    sharing: z
      .object({
        shareProgressWithAdmin: z.boolean(),
        shareNutritionWithAdmin: z.boolean(),
      })
      .partial(),
  })
  .partial()
  .strict();
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const updateMeSchema = z.object({ name: text(100) }).partial().strict();

// ---- Admin --------------------------------------------------------------
export const adminUserListQuerySchema = searchQuerySchema.extend({
  role: z.enum(ENABLED_ROLES as [string, ...string[]]).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const adminUpdateUserSchema = z
  .object({
    status: z.enum(USER_STATUSES),
    role: z.enum(ENABLED_ROLES as [string, ...string[]]),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
