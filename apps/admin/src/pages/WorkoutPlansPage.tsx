import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PLAN_STATUSES, enumLabel, type Paginated, type WorkoutPlanSummaryDTO } from "@recomptrack/shared";
import { EmptyState, ErrorBanner, PageHeader, Pagination, StatusBadge, formatDate } from "../components/ui";
import { useDebounced } from "../hooks/useDebounced";
import { api } from "../services/api";

export function WorkoutPlansPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [latestOnly, setLatestOnly] = useState(true);
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const list = useQuery({
    queryKey: ["admin-plans", q, status, latestOnly, page],
    queryFn: () => api<Paginated<WorkoutPlanSummaryDTO>>("/admin/workout-plans", { query: { q, status, latestOnly: String(latestOnly), page } }),
  });

  return (
    <>
      <PageHeader
        title="Workout Plans"
        subtitle="Build, version and assign training plans"
        actions={<button className="btn btn-primary" onClick={() => navigate("/workouts/new")}>New plan</button>}
      />
      <div className="toolbar">
        <input type="search" placeholder="Search plans" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All statuses</option>
          {PLAN_STATUSES.map((s) => <option key={s} value={s}>{enumLabel(s)}</option>)}
        </select>
        <label className="chip" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={latestOnly} onChange={(e) => { setLatestOnly(e.target.checked); setPage(1); }} />
          Latest version only
        </label>
      </div>
      <ErrorBanner error={list.error} />
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr><th>Plan</th><th>Goal</th><th>Level</th><th>Schedule</th><th>Version</th><th>Status</th><th>Active users</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {list.data?.items.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/workouts/${p.id}`}>{p.name}</Link>
                  {p.description && <div className="muted small">{p.description.slice(0, 80)}</div>}
                </td>
                <td>{enumLabel(p.goalType)}</td>
                <td>{enumLabel(p.experienceLevel)}</td>
                <td className="nowrap">{p.daysPerWeek} days · {p.durationWeeks} wks</td>
                <td>v{p.version}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="num">{p.activeAssignments ?? 0}</td>
                <td className="nowrap">{formatDate(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data?.items.length === 0 && <EmptyState title="No plans yet">Create your first plan from the exercise master.</EmptyState>}
        {list.data && <Pagination page={page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
      </div>
    </>
  );
}
