import { z } from "zod";

/**
 * Friendlier default messages for every schema in the app (server, admin, mobile).
 * Field-specific messages set on a schema still win over these.
 */
z.config({
  customError: (iss) => {
    if (iss.code === "invalid_type") {
      if (iss.input === undefined || iss.input === null || iss.input === "") return "Required";
      if (iss.expected === "number") return "Enter a number";
    }
    if (iss.code === "invalid_value") return iss.input === "" || iss.input === undefined ? "Required" : "Choose one of the options";
    if (iss.code === "unrecognized_keys") return `Unknown field${iss.keys.length > 1 ? "s" : ""}: ${iss.keys.join(", ")}`;
    return undefined;
  },
});

/** First message per field path — for showing one clear error under each form input. */
export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
