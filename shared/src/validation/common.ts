import { z } from "zod";
import { PAGINATION, RECORD_STATUSES } from "../constants";

export const objectIdSchema = z
  .string()
  .min(1, "Required")
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

/** Trimmed, non-empty string with a max length. */
export const text = (max: number) => z.string().trim().min(1, "Required").max(max);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** Query-string pagination, coerced from strings. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
});

export const statusFilterSchema = z.enum([...RECORD_STATUSES, "ALL"]).optional();

/** ISO date (YYYY-MM-DD) for calendar dates such as date of birth. */
export const isoDateSchema = z.iso.date();
