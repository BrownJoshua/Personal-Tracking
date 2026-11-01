import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Paginated, UserDTO } from "@recomptrack/shared";
import { useDebounced } from "../hooks/useDebounced";
import { api } from "../services/api";

/** Search-and-pick an active member account. */
export function UserPicker({ value, onChange }: { value: UserDTO | null; onChange: (u: UserDTO | null) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useQuery({
    queryKey: ["user-picker", dq],
    queryFn: () => api<Paginated<UserDTO>>("/admin/users", { query: { q: dq, status: "ACTIVE", role: "USER", limit: 8 } }),
    enabled: !value,
  });
  if (value) {
    return (
      <div className="input-group">
        <div style={{ flex: 1 }}>
          <strong>{value.name}</strong> <span className="muted">{value.email}</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }
  return (
    <div>
      <input type="search" placeholder="Search members by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
      <div className="picker-results">
        {list.data?.items.map((u) => (
          <button type="button" key={u.id} className="picker-item" onClick={() => onChange(u)}>
            <span>{u.name}</span>
            <span className="muted small">{u.email}</span>
          </button>
        ))}
        {list.data?.items.length === 0 && <p className="muted small">No active members found.</p>}
      </div>
    </div>
  );
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
