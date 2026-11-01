import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CustomFoodDTO,
  DiaryDayDTO,
  FoodLogDTO,
  MealAssignmentDTO,
  MealType,
  NutritionHistoryDayDTO,
  SavedMealDTO,
  TargetStatusDTO,
} from "@recomptrack/shared";
import { api } from "../services/api";

export const useDiary = (date?: string) =>
  useQuery({ queryKey: ["nutrition", "diary", date ?? "today"], queryFn: () => api<DiaryDayDTO>("/nutrition/diary", { query: { date } }) });
export const useTargets = () => useQuery({ queryKey: ["nutrition", "targets"], queryFn: () => api<TargetStatusDTO>("/nutrition/targets") });
export const useNutritionHistory = (from?: string, to?: string) =>
  useQuery({ queryKey: ["nutrition", "history", from, to], queryFn: () => api<NutritionHistoryDayDTO[]>("/nutrition/history", { query: { from, to } }) });
export const useRecentFoods = () =>
  useQuery({
    queryKey: ["nutrition", "recent"],
    queryFn: () =>
      api<{ foodId: string | null; customFoodId: string | null; name: string; brand: string | null; lastQuantity: number; unit: "g" | "ml" }[]>("/nutrition/recent-foods"),
  });
export const useCustomFoods = () => useQuery({ queryKey: ["nutrition", "custom-foods"], queryFn: () => api<CustomFoodDTO[]>("/nutrition/custom-foods") });
export const useSavedMeals = () => useQuery({ queryKey: ["nutrition", "saved-meals"], queryFn: () => api<SavedMealDTO[]>("/nutrition/saved-meals") });
export const useMealPlans = () => useQuery({ queryKey: ["nutrition", "meal-plans"], queryFn: () => api<MealAssignmentDTO[]>("/nutrition/meal-plans") });

export function useNutritionMutations() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["nutrition"] });
  return {
    addLog: useMutation({
      mutationFn: (body: { foodId?: string; customFoodId?: string; quantity: number; mealType: MealType; localDate?: string }) =>
        api<FoodLogDTO>("/nutrition/logs", { method: "POST", body }),
      onSuccess: refresh,
    }),
    updateLog: useMutation({
      mutationFn: ({ id, ...body }: { id: string; quantity?: number; mealType?: MealType }) => api<FoodLogDTO>(`/nutrition/logs/${id}`, { method: "PATCH", body }),
      onSuccess: refresh,
    }),
    deleteLog: useMutation({ mutationFn: (id: string) => api(`/nutrition/logs/${id}`, { method: "DELETE" }), onSuccess: refresh }),
    logSavedMeal: useMutation({
      mutationFn: ({ id, ...body }: { id: string; mealType: MealType; localDate?: string; portion?: number }) =>
        api<{ logged: number; skipped: number }>(`/nutrition/saved-meals/${id}/log`, { method: "POST", body }),
      onSuccess: refresh,
    }),
    logMealPlan: useMutation({
      mutationFn: ({ id, ...body }: { id: string; mealType: MealType; localDate?: string; portion?: number }) =>
        api<{ logged: number; skipped: number }>(`/nutrition/meal-plans/${id}/log`, { method: "POST", body }),
      onSuccess: refresh,
    }),
    saveMealFromDiary: useMutation({
      mutationFn: (body: { name: string; localDate: string; mealType: MealType }) => api<SavedMealDTO>("/nutrition/saved-meals/from-diary", { method: "POST", body }),
      onSuccess: refresh,
    }),
    deleteSavedMeal: useMutation({ mutationFn: (id: string) => api(`/nutrition/saved-meals/${id}`, { method: "DELETE" }), onSuccess: refresh }),
    deleteCustomFood: useMutation({ mutationFn: (id: string) => api(`/nutrition/custom-foods/${id}`, { method: "DELETE" }), onSuccess: refresh }),
  };
}
