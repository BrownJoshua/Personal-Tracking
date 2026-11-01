import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { USER_STATUSES, enumLabel, type AdminUserDetailDTO, type Paginated, type UserDTO } from "@recomptrack/shared";
import { ConfirmDialog, EmptyState, EnumSelect, ErrorBanner, Modal, PageHeader, Pagination, StatusBadge, formatDate } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useDebounced } from "../hooks/useDebounced";
import { api } from "../services/api";

export function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | "ADMIN" | "USER">("");
  const [status, setStatus] = useState<"" | (typeof USER_STATUSES)[number]>("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const focusId = params.get("focus");
  const [pending, setPending] = useState<{ user: UserDTO; patch: Record<string, string>; label: string } | null>(null);

  const list = useQuery({
    queryKey: ["admin-users", q, role, status, page],
    queryFn: () => api<Paginated<UserDTO>>("/admin/users", { query: { q, role, status, page } }),
  });
  const detail = useQuery({
    queryKey: ["admin-user", focusId],
    queryFn: () => api<AdminUserDetailDTO>(`/admin/users/${focusId}`),
    enabled: !!focusId,
  });

  const update = useMutation({
    mutationFn: (p: { id: string; patch: Record<string, string> }) =>
      api<UserDTO>(`/admin/users/${p.id}`, { method: "PATCH", body: p.patch }),
    onSuccess: () => {
      setPending(null);
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-user"] });
    },
  });

  return (
    <>
      <PageHeader title="User Management" subtitle="Accounts, roles and status" />
      <div className="toolbar">
        <input type="search" placeholder="Search name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={role} onChange={(e) => { setRole(e.target.value as typeof role); setPage(1); }}>
          <option value="">All roles</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
        <EnumSelect values={USER_STATUSES} value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="All statuses" />
      </div>
      <ErrorBanner error={list.error} />
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Last sign-in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((u) => (
              <tr key={u.id}>
                <td>
                  <button className="link-btn" onClick={() => setParams({ focus: u.id })}>
                    {u.name}
                  </button>
                </td>
                <td>{u.email}</td>
                <td>{enumLabel(u.role)}</td>
                <td><StatusBadge status={u.status} /></td>
                <td>{formatDate(u.createdAt)}</td>
                <td>{formatDate(u.lastLoginAt)}</td>
                <td className="row-actions">
                  {u.id !== me?.id && (
                    <button
                      className="btn btn-sm"
                      onClick={() =>
                        setPending({
                          user: u,
                          patch: { status: u.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE" },
                          label: u.status === "ACTIVE" ? "Deactivate" : "Reactivate",
                        })
                      }
                    >
                      {u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data?.items.length === 0 && <EmptyState title="No users match these filters" />}
        {list.data && <Pagination page={page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
      </div>

      <Modal title="User" open={!!focusId} onClose={() => setParams({})}>
        <ErrorBanner error={detail.error} />
        {detail.data && (
          <div className="detail">
            <dl>
              <dt>Name</dt><dd>{detail.data.user.name}</dd>
              <dt>Email</dt><dd>{detail.data.user.email}</dd>
              <dt>Role</dt><dd>{enumLabel(detail.data.user.role)}</dd>
              <dt>Status</dt><dd><StatusBadge status={detail.data.user.status} /></dd>
              <dt>Onboarding</dt><dd>{detail.data.user.onboardingCompleted ? "Completed" : "Not completed"}</dd>
              <dt>Goal</dt><dd>{detail.data.goal ? enumLabel(detail.data.goal.goalType) : "—"}</dd>
              <dt>Activity level</dt><dd>{detail.data.profile.activityLevel ? enumLabel(detail.data.profile.activityLevel) : "—"}</dd>
              <dt>Experience</dt><dd>{detail.data.profile.trainingExperience ? enumLabel(detail.data.profile.trainingExperience) : "—"}</dd>
              <dt>Shares progress</dt><dd>{detail.data.sharing.shareProgressWithAdmin ? "Yes" : "No"}</dd>
              <dt>Shares nutrition</dt><dd>{detail.data.sharing.shareNutritionWithAdmin ? "Yes" : "No"}</dd>
            </dl>
            <p className="muted small">
              Personal measurements, food logs and photos are private. They will only be visible here
              when the user opts in to sharing. This view has been recorded in the audit log.
            </p>
            {detail.data.user.id !== me?.id && (
              <div className="row-actions">
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    setPending({
                      user: detail.data.user,
                      patch: { role: detail.data.user.role === "ADMIN" ? "USER" : "ADMIN" },
                      label: detail.data.user.role === "ADMIN" ? "Remove admin role" : "Make admin",
                    })
                  }
                >
                  {detail.data.user.role === "ADMIN" ? "Remove admin role" : "Make admin"}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!pending}
        title={pending?.label ?? ""}
        message={pending && <>{pending.label} <strong>{pending.user.email}</strong>? They will be signed out of all devices.</>}
        confirmLabel={pending?.label}
        danger={pending?.patch.status === "DEACTIVATED"}
        busy={update.isPending}
        error={update.error?.message}
        onCancel={() => { setPending(null); update.reset(); }}
        onConfirm={() => pending && update.mutate({ id: pending.user.id, patch: pending.patch })}
      />
    </>
  );
}
