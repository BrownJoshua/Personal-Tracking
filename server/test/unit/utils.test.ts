import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "../../src/utils/crypto";
import { diff } from "../../src/utils/diff";
import { paginated } from "../../src/utils/pagination";
import { containsRegex, escapeRegex, normalizedKey, slugify } from "../../src/utils/text";

describe("text utils", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("a.b*(c)")).toBe("a\\.b\\*\\(c\\)");
    expect(containsRegex("(.*)").test("x(.*)y")).toBe(true);
    expect(containsRegex(".*").test("anything")).toBe(false);
  });
  it("slugifies and normalises", () => {
    expect(slugify("Résistance Band!")).toBe("resistance-band");
    expect(normalizedKey(" Chicken  Breast ", null, "COOKED")).toBe("chicken breast||cooked");
  });
});

describe("crypto utils", () => {
  it("generates unique tokens and stable hashes", () => {
    const a = generateToken();
    expect(a).not.toBe(generateToken());
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toHaveLength(64);
  });
});

describe("diff", () => {
  it("reports changed fields only", () => {
    expect(diff({ a: 1, b: [1], updatedAt: 1 }, { a: 2, b: [1], updatedAt: 2 })).toEqual({ a: { from: 1, to: 2 } });
  });
});

describe("pagination", () => {
  it("computes total pages", () => {
    expect(paginated([], 41, 1, 20).totalPages).toBe(3);
    expect(paginated([], 0, 1, 20).totalPages).toBe(1);
  });
});
