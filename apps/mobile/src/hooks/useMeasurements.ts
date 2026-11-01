import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BodyMeasurementDTO, Paginated } from "@recomptrack/shared";
import { api } from "../services/api";

export interface MeasurementSummary {
  latestWeight: { valueKg: number; recordedAt: string } | null;
  weightSevenDayAverageKg: number | null;
  weightEntriesLastSevenDays: number;
  latestWaist: { valueCm: number; recordedAt: string } | null;
}

export const useMeasurementSummary = () =>
  useQuery({ queryKey: ["measurements", "summary"], queryFn: () => api<MeasurementSummary>("/measurements/summary") });

export const useMeasurementHistory = () =>
  useQuery({ queryKey: ["measurements", "list"], queryFn: () => api<Paginated<BodyMeasurementDTO>>("/measurements", { query: { limit: 30 } }) });

export function useLogMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (measurements: Record<string, number>) =>
      api<BodyMeasurementDTO>("/measurements", { method: "POST", body: { measurements } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}
