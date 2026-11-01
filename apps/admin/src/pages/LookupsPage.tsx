import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { LookupDTO } from "@recomptrack/shared";
import { ErrorBanner, PageHeader, StatusBadge } from "../components/ui";
import { api } from "../services/api";

const TYPES = [
  { type: "muscle-groups", title: "Muscle groups" },
  { type: "equipment", title: "Equipment types" },
] as const;

export function LookupsPage() {
  return (
    <>
      <PageHeader title="Muscles & Equipment" subtitle="Categories used to organise and filter exercises" />
      <div className="two-col">
        {TYPES.map((t) => <LookupList key={t.type} {...t} />)}
      </div>
    </>
  );
}

function LookupList({ type, title }: { type: string; title: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const list = useQuery({ queryKey: ["admin-lookups", type], queryFn: () => api<LookupDTO[]>(`/admin/lookups/${type}`) });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-lookups", type] });
    void qc.invalidateQueries({ queryKey: ["lookups"] });
  };
  const create = useMutation({
    mutationFn: (n: string) => api<LookupDTO>(`/admin/lookups/${type}`, { method: "POST", body: { name: n } }),
    onSuccess: () => { setName(""); invalidate(); },
  });
  const toggle = useMutation({
    mutationFn: (l: LookupDTO) =>
      api(`/admin/lookups/${type}/${l.id}`, { method: "PATCH", body: { status: l.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" } }),
    onSuccess: invalidate,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) create.mutate(name.trim());
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      <form className="input-group" onSubmit={submit}>
        <input placeholder={`New ${title.toLowerCase().replace(/s$/, "")}`} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={create.isPending}>Add</button>
      </form>
      <ErrorBanner error={create.error ?? toggle.error ?? list.error} />
      <ul className="list">
        {list.data?.map((l) => (
          <li key={l.id}>
            <span>{l.name}</span>
            <StatusBadge status={l.status} />
            <button className="btn btn-sm" onClick={() => toggle.mutate(l)}>{l.status === "ACTIVE" ? "Archive" : "Restore"}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
