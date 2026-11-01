import { useQuery } from "@tanstack/react-query";
import type { BodyTrendDTO, StrengthExerciseSummaryDTO, StrengthSeriesDTO, TrainingWeekDTO, WeeklyReportDTO } from "@recomptrack/shared";
import { api } from "../services/api";

export const useBodyTrend = (days: number) =>
  useQuery({ queryKey: ["reports", "body", days], queryFn: () => api<BodyTrendDTO>("/reports/body", { query: { days } }) });
export const useStrengthSummary = () =>
  useQuery({ queryKey: ["reports", "strength"], queryFn: () => api<StrengthExerciseSummaryDTO[]>("/reports/strength") });
export const useStrengthSeries = (exerciseId: string | undefined, days: number) =>
  useQuery({
    queryKey: ["reports", "strength", exerciseId, days],
    queryFn: () => api<StrengthSeriesDTO>(`/reports/strength/${exerciseId}`, { query: { days } }),
    enabled: !!exerciseId,
  });
export const useTrainingWeeks = (weeks = 8) =>
  useQuery({ queryKey: ["reports", "training", weeks], queryFn: () => api<TrainingWeekDTO[]>("/reports/training", { query: { weeks } }) });
export const useWeeklyReport = (week?: string) =>
  useQuery({ queryKey: ["reports", "weekly", week ?? "current"], queryFn: () => api<WeeklyReportDTO>("/reports/weekly", { query: { week } }) });
