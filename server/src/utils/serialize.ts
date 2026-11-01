import { Types } from "mongoose";

export const idOf = (v: unknown): string => (v instanceof Types.ObjectId ? v.toHexString() : String(v));
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoRequired = (d: Date): string => d.toISOString();
export const toObjectId = (id: string) => new Types.ObjectId(id);
