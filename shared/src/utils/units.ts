const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => Math.round((kg / KG_PER_LB) * 10) / 10;
export const lbToKg = (lb: number) => Math.round(lb * KG_PER_LB * 100) / 100;
export const cmToIn = (cm: number) => Math.round((cm / CM_PER_IN) * 10) / 10;
export const inToCm = (inches: number) => Math.round(inches * CM_PER_IN * 10) / 10;

/** Whole-years age on a given date, from a YYYY-MM-DD date of birth. */
export function ageOn(dateOfBirth: string, on: Date = new Date()): number {
  const [y, m, d] = dateOfBirth.split("-").map(Number) as [number, number, number];
  let age = on.getUTCFullYear() - y;
  const beforeBirthday = on.getUTCMonth() + 1 < m || (on.getUTCMonth() + 1 === m && on.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}
