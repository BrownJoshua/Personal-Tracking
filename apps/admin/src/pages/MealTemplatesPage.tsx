import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  MEAL_TYPES,
  PLAN_STATUSES,
  enumLabel,
  firstFieldErrors,
  mealTemplateSchema,
  scaleNutrition,
  sumNutrition,
  type FoodDTO,
  type MealTemplateDTO,
  type MealType,
  type NutritionDTO,
  type Paginated,
  type UserDTO,
} from "@recomptrack/shared";
import { ConfirmDialog, EmptyState, EnumSelect, ErrorBanner, Field, Modal, PageHeader, Pagination, StatusBadge } from "../components/ui";
import { UserPicker, todayIso } from "../components/UserPicker";
import { useDebounced } from "../hooks/useDebounced";
import { ApiError, api } from "../services/api";

export function MealTemplatesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [mealType, setMealType] = useState<MealType | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MealTemplateDTO | "new" | null>(null);
  const [assigning, setAssigning] = useState<MealTemplateDTO | null>(null);
  const [action, setAction] = useState<{ kind: string; t: MealTemplateDTO } | null>(null);
  const q = useDebounced(search);
  const list = useQuery({
    queryKey: ["admin-meals", q, status, mealType, page],
    queryFn: () => api<Paginated<MealTemplateDTO>>("/admin/meal-templates", { query: { q, status, mealType, page } }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-meals"] });
  const act = useMutation({
    mutationFn: ({ kind, t }: { kind: string; t: MealTemplateDTO }) =>
      kind === "delete" ? api(`/admin/meal-templates/${t.id}`, { method: "DELETE" }) : api(`/admin/meal-templates/${t.id}/${kind}`, { method: "POST" }),
    onSuccess: () => { setAction(null); refresh(); },
  });

  return (
    <>
      <PageHeader
        title="Meal Plans"
        subtitle="Meal templates built from the food master — totals are calculated from ingredients"
        actions={<button className="btn btn-primary" onClick={() => setEditing("new")}>New meal template</button>}
      />
      <div className="toolbar">
        <input type="search" placeholder="Search templates" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All statuses</option>
          {PLAN_STATUSES.map((s) => <option key={s} value={s}>{enumLabel(s)}</option>)}
        </select>
        <EnumSelect values={MEAL_TYPES} value={mealType} onChange={(v) => { setMealType(v); setPage(1); }} placeholder="All meals" />
      </div>
      <ErrorBanner error={list.error} />
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr><th>Template</th><th>Meal</th><th className="num">kcal</th><th className="num">Protein</th><th className="num">Carbs</th><th className="num">Fat</th><th>Status</th><th className="num">Members</th><th /></tr>
          </thead>
          <tbody>
            {list.data?.items.map((t) => (
              <tr key={t.id}>
                <td>
                  <button className="link-btn" onClick={() => setEditing(t)}>{t.name}</button>
                  <div className="muted small">{t.ingredients.map((i) => i.name).join(" + ")}</div>
                </td>
                <td>{enumLabel(t.mealType)}</td>
                <td className="num">{Math.round(t.totalNutrition.calories)}</td>
                <td className="num">{t.totalNutrition.protein}</td>
                <td className="num">{t.totalNutrition.carbohydrates}</td>
                <td className="num">{t.totalNutrition.fat}</td>
                <td><StatusBadge status={t.status} /></td>
                <td className="num">{t.activeAssignments ?? 0}</td>
                <td className="row-actions">
                  {t.status === "DRAFT" && <button className="btn btn-sm" onClick={() => act.mutate({ kind: "publish", t })}>Publish</button>}
                  {t.status === "PUBLISHED" && <button className="btn btn-sm" onClick={() => setAssigning(t)}>Assign</button>}
                  {t.status === "PUBLISHED" && <button className="btn btn-sm" onClick={() => setAction({ kind: "archive", t })}>Archive</button>}
                  {t.status === "ARCHIVED" && <button className="btn btn-sm" onClick={() => act.mutate({ kind: "restore", t })}>Restore</button>}
                  {t.status === "DRAFT" && <button className="btn btn-sm btn-danger-outline" onClick={() => setAction({ kind: "delete", t })}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data?.items.length === 0 && <EmptyState title="No meal templates yet" />}
        {list.data && <Pagination page={page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
      </div>
      <ErrorBanner error={act.error && !action ? act.error : null} />

      <Modal title={editing === "new" ? "New meal template" : "Edit meal template"} open={!!editing} onClose={() => setEditing(null)} wide>
        <MealTemplateForm template={editing && editing !== "new" ? editing : undefined} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      </Modal>
      {assigning && <AssignMealModal template={assigning} onClose={() => setAssigning(null)} onDone={refresh} />}
      <ConfirmDialog
        open={!!action}
        title={action?.kind === "delete" ? "Delete template" : "Archive template"}
        message={action?.kind === "delete" ? <>Delete <strong>{action.t.name}</strong>? Only possible if it was never assigned or logged.</> : <>Archive <strong>{action?.t.name}</strong>? Active assignments end; logged meals are unchanged.</>}
        confirmLabel={action?.kind === "delete" ? "Delete" : "Archive"}
        danger
        busy={act.isPending}
        error={act.error?.message}
        onCancel={() => { setAction(null); act.reset(); }}
        onConfirm={() => action && act.mutate(action)}
      />
    </>
  );
}

interface Ing { food: Pick<FoodDTO, "id" | "name" | "brand" | "preparation" | "servingBasis" | "servingUnit"> & { nutrition: NutritionDTO }; quantity: number }

function MealTemplateForm({ template, onSaved, onCancel }: { template?: MealTemplateDTO; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [mealType, setMealType] = useState<MealType | "">(template?.mealType ?? "");
  const [tags, setTags] = useState(template?.tags.join(", ") ?? "");
  const [ings, setIngs] = useState<Ing[]>(
    () =>
      template?.ingredients.map((i) => ({
        // Per-basis values reconstructed from the ingredient's scaled nutrition.
        food: { id: i.foodId, name: i.name, brand: i.brand, preparation: (i.preparation ?? "RAW") as FoodDTO["preparation"], servingBasis: i.quantity, servingUnit: i.unit === "ml" ? "MILLILITRE" : "GRAM", nutrition: i.nutrition },
        quantity: i.quantity,
      })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const foods = useQuery({ queryKey: ["picker-foods", dq], queryFn: () => api<Paginated<FoodDTO>>("/admin/foods", { query: { q: dq, status: "ACTIVE", limit: 20 } }) });

  const rows = ings.map((i) => ({ ...i, n: scaleNutrition(i.food.nutrition, i.food.servingBasis, i.quantity || 0) }));
  const totals = sumNutrition(rows.map((r) => r.n));

  const save = useMutation({
    mutationFn: (body: unknown) => (template ? api(`/admin/meal-templates/${template.id}`, { method: "PUT", body }) : api("/admin/meal-templates", { method: "POST", body })),
    onSuccess: onSaved,
    onError: (e) => e instanceof ApiError && setErrors(e.fieldErrors()),
  });

  function submit() {
    const body = {
      name,
      description,
      mealType,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      ingredients: ings.map((i) => ({ foodId: i.food.id, quantity: i.quantity })),
    };
    const parsed = mealTemplateSchema.safeParse(body);
    if (!parsed.success) return setErrors(firstFieldErrors(parsed.error));
    setErrors({});
    save.mutate(body);
  }

  return (
    <div className="form-grid">
      <Field label="Name" error={errors.name}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="High-protein breakfast" /></Field>
      <Field label="Meal" error={errors.mealType}><EnumSelect values={MEAL_TYPES} value={mealType} onChange={setMealType} placeholder="Select…" /></Field>
      <Field label="Description" className="span-2"><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Tags" hint="Comma separated, e.g. vegetarian, high-protein" className="span-2"><input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>

      <div className="span-2">
        <h3>Ingredients</h3>
        {errors.ingredients && <p className="error-text">{errors.ingredients}</p>}
        {rows.map((r, i) => (
          <div key={`${r.food.id}-${i}`} className="input-group" style={{ marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              {r.food.name} <span className="muted small">{r.food.brand ?? ""} {enumLabel(r.food.preparation)}</span>
              <div className="muted small">{r.n.calories} kcal · P {r.n.protein} · C {r.n.carbohydrates} · F {r.n.fat}</div>
            </div>
            <input aria-label={`Quantity of ${r.food.name}`} type="number" min={1} style={{ width: 100 }} value={r.quantity} onChange={(e) => setIngs((l) => l.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} />
            <span className="muted">{r.food.servingUnit === "MILLILITRE" ? "ml" : "g"}</span>
            <button className="icon-btn" aria-label="Remove ingredient" onClick={() => setIngs((l) => l.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <div className="totals-bar" style={{ margin: "10px 0" }}>
          <div><strong>{Math.round(totals.calories)}</strong><span className="muted small">kcal</span></div>
          <div><strong>{totals.protein}</strong><span className="muted small">protein g</span></div>
          <div><strong>{totals.carbohydrates}</strong><span className="muted small">carbs g</span></div>
          <div><strong>{totals.fat}</strong><span className="muted small">fat g</span></div>
          <div><strong>{totals.fibre}</strong><span className="muted small">fibre g</span></div>
        </div>
        <input type="search" placeholder="Search foods to add" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" />
        <div className="picker-results">
          {foods.data?.items.map((f) => (
            <button key={f.id} type="button" className="picker-item" onClick={() => setIngs((l) => [...l, { food: f, quantity: f.servingSizes[0]?.quantity ?? 100 }])}>
              <span>{f.name} <span className="muted small">{f.brand ?? ""} · {enumLabel(f.preparation)}</span></span>
              <span className="muted small">{f.nutrition.calories} kcal / {f.servingBasis}{f.servingUnit === "GRAM" ? "g" : "ml"}</span>
            </button>
          ))}
        </div>
      </div>
      {save.error && !(save.error instanceof ApiError && save.error.details) && <p className="error-text span-2">{save.error.message}</p>}
      <div className="form-actions span-2">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save template"}</button>
      </div>
    </div>
  );
}

export function AssignMealModal({ template, user, onClose, onDone }: { template?: MealTemplateDTO; user?: UserDTO; onClose: () => void; onDone: () => void }) {
  const [member, setMember] = useState<UserDTO | null>(user ?? null);
  const [templateId, setTemplateId] = useState(template?.id ?? "");
  const [startDate, setStartDate] = useState(todayIso());
  const published = useQuery({
    queryKey: ["published-meals"],
    queryFn: () => api<Paginated<MealTemplateDTO>>("/admin/meal-templates", { query: { status: "PUBLISHED", limit: 100 } }),
    enabled: !template,
  });
  const assign = useMutation({
    mutationFn: () => api("/admin/meal-assignments", { method: "POST", body: { userId: member!.id, mealTemplateId: templateId, startDate } }),
    onSuccess: () => { onDone(); onClose(); },
  });
  return (
    <Modal
      title="Assign meal"
      open
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!member || !templateId || assign.isPending} onClick={() => assign.mutate()}>Assign</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Member" className="span-2">{user ? <strong>{user.name}</strong> : <UserPicker value={member} onChange={setMember} />}</Field>
        <Field label="Meal template" className="span-2">
          {template ? <strong>{template.name}</strong> : (
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Select a published template…</option>
              {published.data?.items.map((t) => <option key={t.id} value={t.id}>{t.name} ({enumLabel(t.mealType)}, {Math.round(t.totalNutrition.calories)} kcal)</option>)}
            </select>
          )}
        </Field>
        <Field label="Start date"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        {assign.error && <p className="error-text span-2">{assign.error.message}</p>}
      </div>
    </Modal>
  );
}
