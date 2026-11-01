import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { AdminDashboardDTO } from "@recomptrack/shared";
import { ErrorBanner, PageHeader, formatDate } from "../components/ui";
import { api } from "../services/api";

const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days" } as const;

export function DashboardPage() {
  const [days, setDays] = useState<keyof typeof RANGES>("7");
  const q = useQuery({
    queryKey: ["dashboard", days],
    queryFn: () =>
      api<AdminDashboardDTO>("/admin/dashboard", {
        query: { from: new Date(Date.now() - Number(days) * 86400000).toISOString() },
      }),
  });
  const d = q.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Platform overview"
        actions={
          <select value={days} onChange={(e) => setDays(e.target.value as keyof typeof RANGES)}>
            {Object.entries(RANGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        }
      />
      <ErrorBanner error={q.error} />
      <div className="stat-grid">
        <Stat label="Registered users" value={d?.users.total} sub={d && `${d.users.newInRange} new in range`} />
        <Stat label="Active users" value={d?.users.activeInRange} sub="Signed in during range" />
        <Stat label="Workout sessions" value={d?.activity.workoutSessionsInRange} sub="Completed in range" />
        <Stat label="Exercises" value={d?.catalogue.exercises} sub={d && `${d.catalogue.archivedExercises} archived`} />
        <Stat label="Foods" value={d?.catalogue.foods} sub={d && `${d.catalogue.archivedFoods} archived`} />
        <Stat label="Published workout plans" value={d?.plans.activeWorkoutPlans} />
        <Stat label="Food log entries" value={d?.activity.foodLogsInRange} sub="In range" />
        <Stat label="Measurements logged" value={d?.activity.measurementsInRange} sub="In range" />
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Latest registrations</h2>
          {d?.latestRegistrations.length ? (
            <ul className="list">
              {d.latestRegistrations.map((u) => (
                <li key={u.id}>
                  <Link to={`/users?focus=${u.id}`}>{u.name}</Link>
                  <span className="muted">{u.email}</span>
                  <span className="muted">{formatDate(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No users yet.</p>
          )}
        </section>
        <section className="card">
          <h2>Recent admin changes</h2>
          {d?.latestAdminChanges.length ? (
            <ul className="list">
              {d.latestAdminChanges.map((a) => (
                <li key={a.id}>
                  <span>{a.summary}</span>
                  <span className="muted">{a.actor?.name ?? "System"}</span>
                  <span className="muted">{formatDate(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No changes recorded yet.</p>
          )}
          <Link to="/audit">View full audit log →</Link>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value?: number; sub?: string | false | undefined }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value ?? "—"}</span>
      {sub && <span className="muted">{sub}</span>}
    </div>
  );
}
