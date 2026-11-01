import { describe, expect, it } from "vitest";
import { dailyMeans, trailingAverage, weekStart, weeklyRate, weeklyRecommendations, type WeeklyInputs } from "../src";

describe("trend maths", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday → previous Monday
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });
  it("averages multiple entries per day and uses a calendar-day window", () => {
    expect(dailyMeans([{ date: "2026-11-01", value: 70 }, { date: "2026-11-01", value: 71 }])).toEqual([{ date: "2026-11-01", value: 70.5 }]);
    const avg = trailingAverage([
      { date: "2026-10-01", value: 80 },
      { date: "2026-10-20", value: 70 },
      { date: "2026-10-21", value: 72 },
    ]);
    // The 1 Oct entry is outside the 7-day window of 20–21 Oct.
    expect(avg.map((a) => a.value)).toEqual([80, 70, 71]);
  });
  it("computes a weekly rate from a linear fit", () => {
    const pts = [0, 7, 14].map((d, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10), value: 80 - i * 0.5 }));
    expect(weeklyRate(pts)).toBe(-0.5);
    expect(weeklyRate(pts.slice(0, 1))).toBeNull();
  });
});

describe("weekly recommendations", () => {
  const base: WeeklyInputs = {
    goalType: "FAT_LOSS",
    nutrition: { daysLogged: 6, avgCalories: 1900, avgProtein: 150, targetCalories: 2000, targetProtein: 150 },
    training: { sessions: 4, plannedPerWeek: 4, personalRecords: 1, discomfortReports: 0 },
    body: { weighIns: 5, avgWeightKg: 79.5, prevAvgWeightKg: 80, waistChangeCm: -1 },
  };
  it("praises an on-track week", () => {
    const r = weeklyRecommendations(base);
    expect(r.every((x) => x.tone === "positive")).toBe(true);
    expect(r.map((x) => x.kind)).toEqual(expect.arrayContaining(["BODY", "PRAISE"]));
  });
  it("asks for more logging rather than judging sparse data", () => {
    const r = weeklyRecommendations({ ...base, nutrition: { ...base.nutrition, daysLogged: 2 }, body: { ...base.body, weighIns: 1 } });
    expect(r.filter((x) => x.kind === "LOGGING")).toHaveLength(2);
    expect(r.some((x) => x.kind === "NUTRITION" || x.kind === "BODY")).toBe(false);
  });
  it("flags low protein, missed workouts, weight moving the wrong way and repeated discomfort", () => {
    const r = weeklyRecommendations({
      ...base,
      nutrition: { ...base.nutrition, avgProtein: 100 },
      training: { sessions: 1, plannedPerWeek: 4, personalRecords: 0, discomfortReports: 2 },
      body: { ...base.body, avgWeightKg: 81, waistChangeCm: null },
    });
    const kinds = r.filter((x) => x.tone === "attention").map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["NUTRITION", "RECOVERY", "BODY"]));
    expect(r.find((x) => x.kind === "TRAINING")?.text).toContain("1 of 4");
  });
});
