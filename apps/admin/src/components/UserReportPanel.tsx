import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AdminUserReportDTO } from "@recomptrack/shared";
import { addDays } from "@recomptrack/shared";
import { ApiError, api } from "../services/api";
import { LineChart, chartColors } from "./Charts";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Member progress report — only sections the member chose to share. Loading it is audited. */
export function UserReportPanel({ userId, sharing }: { userId: string; sharing: { shareProgressWithAdmin: boolean; shareNutritionWithAdmin: boolean } }) {
  const [open, setOpen] = useState(false);
  const [week, setWeek] = useState<string | undefined>();
  const shared = sharing.shareProgressWithAdmin || sharing.shareNutritionWithAdmin;
  const q = useQuery({
    queryKey: ["admin-user-report", userId, week],
    queryFn: () => api<AdminUserReportDTO>(`/admin/users/${userId}/report`, { query: { week } }),
    enabled: open && shared,
    retry: false,
  });

  if (!shared) {
    return (
      <div className="section">
        <h3>Progress report</h3>
        <p className="muted">This member hasn't shared progress or nutrition with admins. They can turn sharing on in the app's Profile tab.</p>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="section">
        <h3>Progress report</h3>
        <p className="muted small">Shared by the member: {[sharing.shareProgressWithAdmin && "progress", sharing.shareNutritionWithAdmin && "nutrition"].filter(Boolean).join(" and ")}. Opening it is recorded in the audit log.</p>
        <button className="btn btn-sm" onClick={() => setOpen(true)}>View shared report</button>
      </div>
    );
  }
  const d = q.data;
  const r = d?.report;
  return (
    <div className="section">
      <div className="input-group" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Progress report {r && <span className="muted small">{fmt(r.weekStart)} – {fmt(r.weekEnd)}</span>}</h3>
        {r && (
          <span className="input-group">
            <button className="btn btn-sm" aria-label="Previous week" onClick={() => setWeek(addDays(r.weekStart, -7))}>‹</button>
            <button className="btn btn-sm" aria-label="Next week" onClick={() => setWeek(addDays(r.weekStart, 7))}>›</button>
          </span>
        )}
      </div>
      {q.error && <p className="error-text">{q.error instanceof ApiError && q.error.code === "CONSENT_REQUIRED" ? "Sharing was turned off by the member." : q.error.message}</p>}
      {r && (
        <div className="form-grid">
          {r.nutrition ? (
            <div>
              <h3>Nutrition</h3>
              <p>{r.nutrition.daysLogged}/7 days logged</p>
              <p className="muted">Avg {r.nutrition.avgCalories ?? "—"} kcal · protein {r.nutrition.avgProtein ?? "—"} g{r.nutrition.target ? ` (target ${r.nutrition.target.calories} kcal / ${r.nutrition.target.protein} g)` : ""}</p>
            </div>
          ) : <p className="muted">Nutrition not shared.</p>}
          {r.training ? (
            <div>
              <h3>Training</h3>
              <p>{r.training.sessions}{r.training.plannedPerWeek ? `/${r.training.plannedPerWeek}` : ""} workouts · {r.training.workingSets} sets</p>
              <p className="muted">{Math.round(r.training.volumeKg).toLocaleString()} kg volume{r.training.discomfortReports ? ` · ${r.training.discomfortReports} discomfort report(s)` : ""}{r.training.personalRecords.length ? ` · ${r.training.personalRecords.length} PR` : ""}</p>
            </div>
          ) : <p className="muted">Progress not shared.</p>}
          {r.body && (
            <div className="span-2">
              <p>Avg weight {r.body.avgWeightKg ?? "—"} kg{r.body.changeKg !== null ? ` (${r.body.changeKg > 0 ? "+" : ""}${r.body.changeKg} kg vs last week)` : ""} · {r.body.weighIns} weigh-ins{r.body.latestWaistCm !== null ? ` · waist ${r.body.latestWaistCm} cm` : ""}</p>
            </div>
          )}
          {d?.bodyTrend && d.bodyTrend.weight.length > 0 && (
            <div className="span-2">
              <LineChart
                title="Weight · last 90 days"
                unit="kg"
                series={[
                  { key: "raw", label: "Daily weigh-in", color: chartColors.context, style: "dots", points: d.bodyTrend.weight.map((w) => ({ x: w.date, y: w.valueKg })) },
                  { key: "avg", label: "7-day average", color: chartColors.series1, style: "line", points: d.bodyTrend.weight.map((w) => ({ x: w.date, y: w.average7d })) },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
