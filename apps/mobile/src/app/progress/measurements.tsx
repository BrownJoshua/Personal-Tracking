import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { createMeasurementSchema, firstFieldErrors } from "@recomptrack/shared";
import { Button, Card, ErrorNote, Screen, TextField, styles } from "../../components/ui";
import { useLogMeasurement } from "../../hooks/useMeasurements";

const GROUPS = [
  { title: "Body", fields: [["weightKg", "Weight (kg)"], ["bodyFatPercent", "Body fat (%)"], ["waistCm", "Waist (cm)"], ["hipsCm", "Hips (cm)"]] },
  { title: "Upper body", fields: [["neckCm", "Neck (cm)"], ["shouldersCm", "Shoulders (cm)"], ["chestCm", "Chest (cm)"], ["leftArmCm", "Left arm (cm)"], ["rightArmCm", "Right arm (cm)"]] },
  { title: "Lower body", fields: [["leftThighCm", "Left thigh (cm)"], ["rightThighCm", "Right thigh (cm)"], ["leftCalfCm", "Left calf (cm)"], ["rightCalfCm", "Right calf (cm)"]] },
] as const;

/** Weekly measurements. Only filled-in fields are saved; earlier entries are never overwritten. */
export default function MeasurementsScreen() {
  const [v, setV] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const log = useLogMeasurement();

  function submit() {
    const measurements = Object.fromEntries(
      Object.entries(v)
        .filter(([, s]) => s.trim() !== "")
        .map(([k, s]) => [k, Number(s.replace(",", "."))]),
    );
    const parsed = createMeasurementSchema.safeParse({ measurements });
    if (!parsed.success) return setErrors(firstFieldErrors(parsed.error));
    setErrors({});
    log.mutate(measurements, { onSuccess: () => router.back() });
  }

  return (
    <Screen>
      <Text style={styles.muted}>Measure at the same time of day each week, relaxed, tape snug but not tight. Fill in what you measured.</Text>
      {errors.measurements && <Text style={{ color: "#FB7185" }}>{errors.measurements}</Text>}
      {GROUPS.map((g) => (
        <Card key={g.title} title={g.title}>
          {g.fields.map(([k, label]) => (
            <TextField key={k} label={label} keyboardType="decimal-pad" value={v[k] ?? ""} onChangeText={(t) => setV({ ...v, [k]: t })} error={errors[`measurements.${k}`]} />
          ))}
        </Card>
      ))}
      <ErrorNote error={log.error} />
      <Button title="Save measurements" onPress={submit} loading={log.isPending} />
    </Screen>
  );
}
