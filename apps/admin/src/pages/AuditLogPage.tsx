import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { enumLabel, type AuditLogDTO, type Paginated } from "@recomptrack/shared";
import { ErrorBanner, PageHeader, Pagination, formatDate } from "../components/ui";
import { api } from "../services/api";

const ENTITY_TYPES = ["EXERCISE", "FOOD", "USER", "WORKOUT_PLAN", "MEAL_TEMPLATE", "TARGET_SETTINGS", "MUSCLE_GROUP", "EQUIPMENT_TYPE"];

export function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["audit", entityType, page],
    queryFn: () => api<Paginated<AuditLogDTO>>("/admin/audit-logs", { query: { entityType, page } }),
  });
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Every administrative change, and every admin view of a user account" />
      <div className="toolbar">
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
          <option value="">All entities</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
        </select>
      </div>
      <ErrorBanner error={q.error} />
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr><th>When</th><th>Admin</th><th>Action</th><th>Summary</th><th /></tr>
          </thead>
          <tbody>
            {q.data?.items.map((a) => (
              <Fragment key={a.id}>
                <tr>
                  <td className="nowrap">{formatDate(a.createdAt)}</td>
                  <td>{a.actor?.name ?? "System"}</td>
                  <td className="mono small">{a.action}</td>
                  <td>{a.summary}</td>
                  <td>{a.changes && <button className="btn btn-sm" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Hide" : "Changes"}</button>}</td>
                </tr>
                {open === a.id && a.changes && (
                  <tr className="sub-row">
                    <td colSpan={5}>
                      <table className="table table-compact">
                        <thead><tr><th>Field</th><th>From</th><th>To</th></tr></thead>
                        <tbody>
                          {Object.entries(a.changes).map(([field, c]) => (
                            <tr key={field}><td className="mono">{field}</td><td className="mono small">{JSON.stringify(c.from)}</td><td className="mono small">{JSON.stringify(c.to)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {q.data && <Pagination page={page} totalPages={q.data.totalPages} total={q.data.total} onPage={setPage} />}
      </div>
    </>
  );
}
