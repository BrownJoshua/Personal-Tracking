/** Escape user input for safe use inside a RegExp (prevents ReDoS / regex injection). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive "contains" matcher for search boxes. */
export function containsRegex(input: string): RegExp {
  return new RegExp(escapeRegex(input), "i");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Normalised key used for duplicate detection, e.g. "chicken breast|generic|cooked". */
export function normalizedKey(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => (p ?? "").trim().toLowerCase().replace(/\s+/g, " ")).join("|");
}
