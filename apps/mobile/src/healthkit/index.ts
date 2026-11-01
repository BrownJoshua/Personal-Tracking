/**
 * Apple Health boundary (Phase 5).
 *
 * HealthKit is only reachable from native iOS code, so it will be added as a
 * config-plugin-based native module in a development build (not Expo Go). The rest
 * of the app talks to this interface only, keeping integrations decoupled from
 * workout and nutrition logic.
 */
export type HealthDataType =
  | "steps"
  | "activeEnergy"
  | "workouts"
  | "cyclingDistance"
  | "heartRate"
  | "restingHeartRate"
  | "sleep"
  | "bodyMass";

export interface HealthProvider {
  isAvailable(): Promise<boolean>;
  requestPermissions(types: HealthDataType[]): Promise<{ granted: HealthDataType[]; denied: HealthDataType[] }>;
  disconnect(): Promise<void>;
}

/** Placeholder until the native module exists. Reports "unavailable" rather than inventing data. */
export const healthProvider: HealthProvider = {
  isAvailable: async () => false,
  requestPermissions: async (types) => ({ granted: [], denied: types }),
  disconnect: async () => {},
};
