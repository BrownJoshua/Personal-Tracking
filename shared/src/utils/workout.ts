import type { SetType } from "../constants";

export interface SetLike {
  weightKg: number | null;
  reps: number | null;
  setType: SetType;
  completed: boolean;
}

/** Epley estimated one-rep max. Only meaningful for 1–12 reps. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + Math.min(reps, 12) / 30) * 10) / 10;
}

const counts = (s: SetLike) => s.completed && s.setType !== "WARM_UP" && (s.reps ?? 0) > 0;

export function summarizeSets(sets: SetLike[]) {
  let workingSets = 0;
  let reps = 0;
  let volumeKg = 0;
  let bestOneRepMax = 0;
  let heaviestKg = 0;
  for (const s of sets) {
    if (!counts(s)) continue;
    workingSets += 1;
    reps += s.reps ?? 0;
    const w = s.weightKg ?? 0;
    volumeKg += w * (s.reps ?? 0);
    heaviestKg = Math.max(heaviestKg, w);
    bestOneRepMax = Math.max(bestOneRepMax, estimateOneRepMax(w, s.reps ?? 0));
  }
  return { workingSets, reps, volumeKg: Math.round(volumeKg * 10) / 10, bestOneRepMax, heaviestKg };
}

/** Active training time, excluding pauses. */
export function activeDurationSeconds(startedAt: Date, endedAt: Date, pausedSeconds: number): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000) - pausedSeconds);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
