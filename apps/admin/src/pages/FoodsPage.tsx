import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FOOD_CATEGORIES, FOOD_KINDS, enumLabel, type FoodCategory, type FoodDTO, type FoodKind, type Paginated } from "@recomptrack/shared";
import { ConfirmDialog, EmptyState, EnumSelect, ErrorBanner, Modal, PageHeader, Pagination, StatusBadge } from "../components/ui";
import { useDebounced } from "../hooks/useDebounced";
import { api } from "../services/api";
import { FoodForm } from "./FoodForm";

type Action = { kind: "archive" | "restore" | "delete"; food: FoodDTO };

export function FoodsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED" | "ALL">("ACTIVE");
  const [category, setCategory] = useState<FoodCategory | "">("");
  const [kind, setKind] = useState<FoodKind | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<FoodDTO | "new" | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const q = useDebounced(search);

  const list = useQuery({
    queryKey: ["admin-foods", q, status, category, kind, page],
    queryFn: () => api<Paginated<FoodDTO>>("/admin/foods", { query: { q, status, category, kind, page } }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-foods"] });
  const act = useMutation({
    mutationFn: ({ kind, food }: Action) =>
      kind === "delete" ? api(`/admin/foods/${food.id}`, { method: "DELETE" }) : api(`/admin/foods/${food.id}/${kind}`, { method: "POST" }),
    onSuccess: () => {
      setAction(null);
      refresh();
    },
  });
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Food Master"
        subtitle="Foods users can search and log"
        actions={<button className="btn btn-primary" onClick={() => setEditing("new")}>Add food</button>}
      />
      <div className="toolbar">
        <input type="search" placeholder="Search name, brand or barcode" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} />
        <select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as typeof status)}>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="ALL">All</option>
        </select>
        <EnumSelect values={FOOD_CATEGORIES} value={category} onChange={resetPage(setCategory)} placeholder="All categories" />
        <EnumSelect values={FOOD_KINDS} value={kind} onChange={resetPage(setKind)} placeholder="Generic & branded" />
      </div>
      <ErrorBanner error={list.error} />
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Preparation</th>
              <th>Per</th>
              <th className="num">kcal</th>
              <th className="num">Protein</th>
              <th className="num">Carbs</th>
              <th className="num">Fat</th>
              <th className="num">Fibre</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((f) => (
              <tr key={f.id}>
                <td>
                  <button className="link-btn" onClick={() => setEditing(f)}>{f.name}</button>
                  <div className="muted small">{f.kind === "BRANDED" ? f.brand : "Generic"} · {enumLabel(f.source)}</div>
                </td>
                <td>{enumLabel(f.category)}</td>
                <td>{enumLabel(f.preparation)}</td>
                <td className="nowrap">{f.servingBasis} {f.servingUnit === "GRAM" ? "g" : "ml"}</td>
                <td className="num">{f.nutrition.calories}</td>
                <td className="num">{f.nutrition.protein}</td>
                <td className="num">{f.nutrition.carbohydrates}</td>
                <td className="num">{f.nutrition.fat}</td>
                <td className="num">{f.nutrition.fibre}</td>
                <td><StatusBadge status={f.status} /></td>
                <td className="row-actions">
                  <button className="btn btn-sm" onClick={() => setEditing(f)}>Edit</button>
                  {f.status === "ACTIVE" ? (
                    <button className="btn btn-sm" onClick={() => setAction({ kind: "archive", food: f })}>Archive</button>
                  ) : (
                    <button className="btn btn-sm" onClick={() => setAction({ kind: "restore", food: f })}>Restore</button>
                  )}
                  <button className="btn btn-sm btn-danger-outline" onClick={() => setAction({ kind: "delete", food: f })}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data?.items.length === 0 && <EmptyState title="No foods found">Try a different filter, or add a food.</EmptyState>}
        {list.data && <Pagination page={page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
      </div>

      <Modal title={editing === "new" ? "Add food" : "Edit food"} open={!!editing} onClose={() => setEditing(null)} wide>
        <FoodForm
          food={editing && editing !== "new" ? editing : undefined}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!action}
        title={action ? `${enumLabel(action.kind)} food` : ""}
        message={
          action?.kind === "delete" ? (
            <>Permanently delete <strong>{action.food.name}</strong>? Only allowed if no food log or meal template uses it.</>
          ) : action?.kind === "archive" ? (
            <>Archive <strong>{action.food.name}</strong>? Users can no longer find it, but past food logs are unchanged.</>
          ) : (
            <>Restore <strong>{action?.food.name}</strong>?</>
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
