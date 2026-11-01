import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EXERCISE_TYPES, enumLabel, type ExerciseDTO, type ExerciseType, type LookupDTO, type Paginated } from "@recomptrack/shared";
import { ConfirmDialog, EmptyState, EnumSelect, ErrorBanner, Modal, PageHeader, Pagination, StatusBadge } from "../components/ui";
import { useDebounced } from "../hooks/useDebounced";
import { api } from "../services/api";
import { ExerciseForm } from "./ExerciseForm";

type Action = { kind: "archive" | "restore" | "delete"; exercise: ExerciseDTO };

export function ExercisesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED" | "ALL">("ACTIVE");
  const [muscleId, setMuscleId] = useState("");
  const [exerciseType, setExerciseType] = useState<ExerciseType | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ExerciseDTO | "new" | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const q = useDebounced(search);

  const muscles = useQuery({ queryKey: ["lookups", "muscle-groups"], queryFn: () => api<LookupDTO[]>("/lookups/muscle-groups") });
  const list = useQuery({
    queryKey: ["admin-exercises", q, status, muscleId, exerciseType, page],
    queryFn: () => api<Paginated<ExerciseDTO>>("/admin/exercises", { query: { q, status, muscleId, exerciseType, page } }),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-exercises"] });
  const act = useMutation({
    mutationFn: ({ kind, exercise }: Action) =>
      kind === "delete"
        ? api(`/admin/exercises/${exercise.id}`, { method: "DELETE" })
        : api(`/admin/exercises/${exercise.id}/${kind}`, { method: "POST" }),
    onSuccess: () => {
      setAction(null);
      refresh();
    },
  });

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Exercise Master"
        subtitle="Exercises users can see in the app and that plans are built from"
        actions={<button className="btn btn-primary" onClick={() => setEditing("new")}>Add exercise</button>}
      />
      <div className="toolbar">
        <input type="search" placeholder="Search name or code" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} />
        <select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as typeof status)}>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="ALL">All</option>
        </select>
        <select value={muscleId} onChange={(e) => resetPage(setMuscleId)(e.target.value)}>
          <option value="">All muscles</option>
          {muscles.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <EnumSelect values={EXERCISE_TYPES} value={exerciseType} onChange={resetPage(setExerciseType)} placeholder="All types" />
      </div>
      <ErrorBanner error={list.error} />
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Primary muscle</th>
              <th>Equipment</th>
              <th>Type</th>
              <th>Default</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.code}</td>
                <td>
                  <button className="link-btn" onClick={() => setEditing(e)}>{e.name}</button>
                  {e.secondaryMuscles.length > 0 && <div className="muted small">+ {e.secondaryMuscles.map((m) => m.name).join(", ")}</div>}
                </td>
                <td>{e.primaryMuscle?.name ?? "—"}</td>
                <td>{e.equipment?.name ?? "—"}</td>
                <td>{enumLabel(e.exerciseType)}</td>
                <td className="nowrap">
                  {e.defaultSets} × {e.defaultRepMin}–{e.defaultRepMax} · {e.defaultRestSeconds}s
                </td>
                <td><StatusBadge status={e.status} /></td>
                <td className="row-actions">
                  <button className="btn btn-sm" onClick={() => setEditing(e)}>Edit</button>
                  {e.status === "ACTIVE" ? (
                    <button className="btn btn-sm" onClick={() => setAction({ kind: "archive", exercise: e })}>Archive</button>
                  ) : (
                    <button className="btn btn-sm" onClick={() => setAction({ kind: "restore", exercise: e })}>Restore</button>
                  )}
                  <button className="btn btn-sm btn-danger-outline" onClick={() => setAction({ kind: "delete", exercise: e })}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data?.items.length === 0 && <EmptyState title="No exercises found">Try a different filter, or add an exercise.</EmptyState>}
        {list.data && <Pagination page={page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
      </div>

      <Modal title={editing === "new" ? "Add exercise" : "Edit exercise"} open={!!editing} onClose={() => setEditing(null)} wide>
        <ExerciseForm
          exercise={editing && editing !== "new" ? editing : undefined}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!action}
        title={action ? `${enumLabel(action.kind)} exercise` : ""}
        message={
          action?.kind === "delete" ? (
            <>Permanently delete <strong>{action.exercise.name}</strong>? This is only allowed if no plan or logged workout uses it — otherwise archive it.</>
          ) : action?.kind === "archive" ? (
            <>Archive <strong>{action.exercise.name}</strong>? It disappears from the exercise library, but workout history that uses it stays intact.</>
          ) : (
            <>Restore <strong>{action?.exercise.name}</strong> to the exercise library?</>
          )
        }
        confirmLabel={action ? enumLabel(action.kind) : ""}
        danger={action?.kind === "delete"}
        busy={act.isPending}
        error={act.error?.message}
        onCancel={() => { setAction(null); act.reset(); }}
        onConfirm={() => action && act.mutate(action)}
      />
    </>
  );
}
