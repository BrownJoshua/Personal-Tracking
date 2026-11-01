import type { RequestHandler } from "express";
import type { z } from "zod";
import { firstFieldErrors } from "@recomptrack/shared";
import { HttpError } from "../utils/httpError";

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

/** One message per field (the first), so clients can show a single clear error under each input. */
export function zodDetails(error: z.ZodError) {
  return Object.entries(firstFieldErrors(error)).map(([path, message]) => ({ path, message }));
}

/**
 * Validate and *replace* untrusted input with the parsed result.
 * Handlers must read from `req.valid`, never from raw `req.body` / `req.query`.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    req.valid ??= {};
    for (const key of ["params", "query", "body"] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) throw HttpError.validation(zodDetails(result.error));
      req.valid[key] = result.data;
    }
    next();
  };
}
