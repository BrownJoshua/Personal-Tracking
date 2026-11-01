import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AdminAnalyticsDTO } from "@recomptrack/shared";
import { BarChart, chartColors } from "../components/Charts";
import { ErrorBanner, PageHeader } from "../components/ui";
import { api } from "../services/api";

/** Platform analytics — aggregate counts only. Individual reports live on each member (with consent). */
export function ReportsPage() {
  const [weeks, setWeeks] = useState(12);
  const q = useQuery({ queryKey: ["admin-analytics", weeks], queryFn: () => api<AdminAnalyticsDTO>("/admin/analytics", { query: { weeks } }) });
  const d = q.data;
  const series = (k: keyof AdminAnalyticsDTO["weeks"][number]) => d?.weeks.map((w) => ({ label: w.weekStart, value: Number(w[k]) })) ?? [];

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Platform activity by week (UTC). Aggregate counts — no individual health data."
        actions={
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} aria-label="Range">
            <option value={8}>Last 8 weeks</option>
            <option value={12}>Last 12 weeks</option>
            <option value={26}>Last 26 weeks</option>
            <option value={52}>Last 52 weeks</option>
          </select>
        }
      />
      <ErrorBanner error={q.error} />
      {d && (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="card stat"><span className="stat-label">Active members</span><span className="stat-value">{d.totals.members}</span></div>
            <div className="card stat"><span className="stat-label">On a workout plan</span><span className="stat-value">{d.totals.membersWithPlan}</span><span className="muted">{d.totals.members ? Math.round((d.totals.membersWithPlan / d.totals.members) * 100) : 0}% of members</span></div>
            <div className="card stat"><span className="stat-label">Training this week</span><span className="stat-value">{d.totals.membersTrainingThisWeek}</span></div>
            <div className="card stat"><span className="stat-label">Logging food this week</span><span className="stat-value">{d.totals.membersLoggingFoodThisWeek}</span></div>
          </div>
          <div className="chart-grid">
            <section className="card"><BarChart title="Active members (recorded anything)" unit="members" data={series("activeUsers")} /></section>
            <section className="card"><BarChart title="Workouts completed" unit="workouts" data={series("workoutsCompleted")} /></section>
            <section className="card"><BarChart title="Food log entries" unit="entries" color={chartColors.series2} data={series("foodLogEntries")} /></section>
            <section className="card"><BarChart title="New registrations" unit="members" color={chartColors.series2} data={series("newUsers")} /></section>
          </div>
          <div className="two-col">
            <section className="card">
              <h2>Most-logged exercises</h2>
              <table className="table table-compact">
                <thead><tr><th>Exercise</th><th className="num">Logged</th><th className="num">Members</th></tr></thead>
                <tbody>
                  {d.topExercises.map((t) => <tr key={t.exerciseId}><td>{t.exerciseName}</td><td className="num">{t.sessions}</td><td className="num">{t.users}</td></tr>)}
                  {d.topExercises.length === 0 && <tr><td colSpan={3} className="muted">No workouts logged in this range.</td></tr>}
                </tbody>
              </table>
            </section>
            <section className="card">
              <h2>Plan adoption</h2>
              <table className="table table-compact">
                <thead><tr><th>Plan</th><th className="num">Active members</th></tr></thead>
                <tbody>
                  {d.planAdoption.map((p) => <tr key={p.planName}><td>{p.planName}</td><td className="num">{p.activeAssignments}</td></tr>)}
                  {d.planAdoption.length === 0 && <tr><td colSpan={2} className="muted">No active assignments.</td></tr>}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </>
  );
}
