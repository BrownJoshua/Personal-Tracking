import { z } from "zod";
import { EXPERIENCE_LEVELS, GOAL_TYPES, PLAN_STATUSES, SET_TYPES } from "../constants";
import { isoDateSchema, objectIdSchema, optionalText, paginationQuerySchema, searchQuerySchema, text } from "./common";

// ---- Admin: plan builder ------------------------------------------------
export const plannedExerciseSchema = z
  .object({
    exerciseId: objectIdSchema,
    sets: z.number().int().min(1).max(10),
    repMin: z.number().int().min(1).max(100),
    repMax: z.number().int().min(1).max(100),
    restSeconds: z.number().int().min(0).max(900),
    notes: optionalText(300),
  })
  .strict()
  .refine((e) => e.repMin <= e.repMax, { message: "Minimum reps cannot exceed maximum reps", path: ["repMax"] });

export const planDaySchema = z
  .object({
    /** 1 = Monday … 7 = Sunday. Null means "next day in rotation". */
    weekday: z.number().int().min(1).max(7).nullable().default(null),
    dayName: text(60),
    exercises: z.array(plannedExerciseSchema).max(20),
  })
  .strict();

export const savePlanSchema = z
  .object({
    name: text(120),
    description: optionalText(1000),
    goalType: z.enum(GOAL_TYPES),
    experienceLevel: z.enum(EXPERIENCE_LEVELS),
    durationWeeks: z.number().int().min(1).max(52),
    warmUpInstructions: optionalText(1000),
    days: z.array(planDaySchema).min(1, "Add at least one training day").max(7),
  })
  .strict()
  .superRefine((p, ctx) => {
    const weekdays = p.days.map((d) => d.weekday).filter((w): w is number => w !== null);
    if (new Set(weekdays).size !== weekdays.length) {
      ctx.addIssue({ code: "custom", message: "Two days use the same weekday", path: ["days"] });
    }
    if (weekdays.length > 0 && weekdays.length !== p.days.length) {
      ctx.addIssue({ code: "custom", message: "Set a weekday for every day, or for none (rotation)", path: ["days"] });
    }
  });
export type SavePlanInput = z.input<typeof savePlanSchema>;

export const planListQuerySchema = searchQuerySchema.extend({
  status: z.enum([...PLAN_STATUSES, "ALL"]).optional(),
  latestOnly: z.enum(["true", "false"]).default("true"),
});

export const assignPlanSchema = z
  .object({
    userId: objectIdSchema,
    workoutPlanId: objectIdSchema,
    startDate: isoDateSchema,
  })
  .strict();

// ---- User: workout sessions --------------------------------------------
export const startSessionSchema = z
  .object({
    /** Omit for a free workout not tied to the assigned plan. */
    workoutPlanDayId: objectIdSchema.optional(),
  })
  .strict();

export const loggedSetSchema = z
  .object({
    weightKg: z.number().min(0).max(1000).nullable(),
    reps: z.number().int().min(0).max(200).nullable(),
    setType: z.enum(SET_TYPES).default("WORKING"),
    completed: z.boolean().default(false),
    rpe: z.number().min(1).max(10).nullable().default(null),
  })
  .strict();

export const updateExerciseLogSchema = z
  .object({
    sets: z.array(loggedSetSchema).max(30),
    notes: optionalText(500),
    discomfort: z
      .object({
        reported: z.boolean(),
        location: optionalText(80),
        severity: z.number().int().min(1).max(10).nullable().optional(),
        notes: optionalText(300),
      })
      .strict()
      .optional(),
  })
  .partial()
  .strict();
export type UpdateExerciseLogInput = z.input<typeof updateExerciseLogSchema>;

export const addSessionExerciseSchema = z.object({ exerciseId: objectIdSchema }).strict();
export const sessionNotesSchema = z.object({ notes: optionalText(1000) }).strict();
export const sessionHistoryQuerySchema = paginationQuerySchema.extend({
  exerciseId: objectIdSchema.optional(),
});
