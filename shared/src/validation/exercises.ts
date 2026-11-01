import { z } from "zod";
import { EXERCISE_TYPES, MOVEMENT_PATTERNS } from "../constants";
import { objectIdSchema, optionalText, searchQuerySchema, statusFilterSchema, text } from "./common";

const exerciseBase = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,20}$/, "Use 2–20 letters, digits, - or _"),
    name: text(120),
    primaryMuscleId: objectIdSchema,
    secondaryMuscleIds: z.array(objectIdSchema).max(10).default([]),
    equipmentId: objectIdSchema.nullable().default(null),
    exerciseType: z.enum(EXERCISE_TYPES),
    movementPattern: z.enum(MOVEMENT_PATTERNS),
    instructions: z.array(text(500)).max(20).default([]),
    mediaUrl: z.url({ protocol: /^https$/ }).max(2048).nullable().default(null),
    defaultSets: z.number().int().min(1).max(10),
    defaultRepMin: z.number().int().min(1).max(100),
    defaultRepMax: z.number().int().min(1).max(100),
    defaultRestSeconds: z.number().int().min(0).max(900),
    notes: optionalText(1000),
  })
  .strict();

function repRangeValid(v: { defaultRepMin?: number; defaultRepMax?: number }) {
  return v.defaultRepMin === undefined || v.defaultRepMax === undefined || v.defaultRepMin <= v.defaultRepMax;
}
const repRangeIssue = { message: "Minimum reps cannot exceed maximum reps", path: ["defaultRepMax"] };

export const createExerciseSchema = exerciseBase.refine(repRangeValid, repRangeIssue);
export type CreateExerciseInput = z.input<typeof createExerciseSchema>;

export const updateExerciseSchema = exerciseBase
  .partial()
  .refine(repRangeValid, repRangeIssue)
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateExerciseInput = z.input<typeof updateExerciseSchema>;

export const exerciseListQuerySchema = searchQuerySchema.extend({
  status: statusFilterSchema,
  muscleId: objectIdSchema.optional(),
  equipmentId: objectIdSchema.optional(),
  exerciseType: z.enum(EXERCISE_TYPES).optional(),
});

export const lookupSchema = z
  .object({
    name: text(60),
    description: optionalText(300),
  })
  .strict();
