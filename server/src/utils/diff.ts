/** Shallow-ish diff of two plain objects for the audit trail. Nested objects compare by JSON. */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignore: string[] = ["updatedAt", "createdAt", "__v", "_id"],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (ignore.includes(key)) continue;
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}
