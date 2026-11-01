import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CurrentPlanDTO, ExerciseLogDTO, Paginated, TodayWorkoutDTO, WorkoutSessionDTO } from "@recomptrack/shared";
import { api } from "../services/api";

export const useToday = () => useQuery({ queryKey: ["workouts", "today"], queryFn: () => api<TodayWorkoutDTO>("/workouts/today") });
export const useCurrentPlan = () => useQuery({ queryKey: ["workouts", "plan"], queryFn: () => api<CurrentPlanDTO | null>("/workouts/plan") });
export const useActiveSession = () =>
  useQuery({ queryKey: ["workouts", "active"], queryFn: () => api<WorkoutSessionDTO | null>("/workouts/sessions/active") });
export const useSession = (id?: string) =>
  useQuery({ queryKey: ["workouts", "session", id], queryFn: () => api<WorkoutSessionDTO>(`/workouts/sessions/${id}`), enabled: !!id });
export const useHistory = (limit = 20) =>
  useQuery({ queryKey: ["workouts", "history", limit], queryFn: () => api<Paginated<WorkoutSessionDTO>>("/workouts/sessions", { query: { limit } }) });

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutPlanDayId?: string) =>
      api<WorkoutSessionDTO>("/workouts/sessions", { method: "POST", body: workoutPlanDayId ? { workoutPlanDayId } : {} }),
    onSuccess: (s) => {
      qc.setQueryData(["workouts", "active"], s);
      void qc.invalidateQueries({ queryKey: ["workouts", "today"] });
    },
  });
}

/** Invalidate everything workout-related after a session changes state. */
export function useRefreshWorkouts() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["workouts"] });
}

export type { ExerciseLogDTO };
