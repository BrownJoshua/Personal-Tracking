export * from "./roles";
export * from "./enums";

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const PASSWORD_RULES = {
  MIN_LENGTH: 10,
  MAX_LENGTH: 128,
} as const;
