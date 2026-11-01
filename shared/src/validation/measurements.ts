import { z } from "zod";
import { paginationQuerySchema } from "./common";

const cm = z.number().min(10).max(300).nullable().optional();

export const createMeasurementSchema = z
  .object({
    recordedAt: z.iso.datetime({ offset: true }).optional(),
    measurements: z
      .object({
        weightKg: z.number().min(25).max(400).nullable().optional(),
        bodyFatPercent: z.number().min(2).max(70).nullable().optional(),
        waistCm: cm,
        chestCm: cm,
        shouldersCm: cm,
        neckCm: cm,
        leftArmCm: cm,
        rightArmCm: cm,
        hipsCm: cm,
        leftThighCm: cm,
        rightThighCm: cm,
        leftCalfCm: cm,
        rightCalfCm: cm,
      })
      .strict()
      .refine((m) => Object.values(m).some((v) => v !== null && v !== undefined), "Enter at least one measurement"),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();
export type CreateMeasurementInput = z.input<typeof createMeasurementSchema>;

export const measurementListQuerySchema = paginationQuerySchema.extend({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});
