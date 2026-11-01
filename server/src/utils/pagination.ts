import type { Paginated } from "@recomptrack/shared";

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, limit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
