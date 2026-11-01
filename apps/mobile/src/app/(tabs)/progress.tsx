import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, EmptyNote, ErrorNote, Screen, styles } from "../../components/ui";
import { WeightEntry } from "../../components/WeightEntry";
import { useMeasurementHistory } from "../../hooks/useMeasurements";
import { colors } from "../../theme";

const LABELS: Record<string, string> = {
  weightKg: "Weight", bodyFatPercent: "Body fat", waistCm: "Waist", hipsCm: "Hips", neckCm: "Neck", shouldersCm: "Shoulders", chestCm: "Chest",
  leftArmCm: "L arm", rightArmCm: "R arm", leftThighCm: "L thigh", rightThighCm: "R thigh", leftCalfCm: "L calf", rightCalfCm: "R calf",
};
const unit = (k: string) => (k === "weightKg" ? "kg" : k === "bodyFatPercent" ? "%" : "cm");

/** Simple weight trend from recorded entries (oldest → newest). */
function WeightTrend({ points }: { points: { at: string; kg: number }[] }) {
  if (points.length < 2) return <EmptyNote>Log at least two weigh-ins to see a trend.</EmptyNote>;
  const min = Math.min(...points.map((p) => p.kg));
  const max = Math.max(...points.map((p) => p.kg));
  const range = Math.max(0.5, max - min);
  const first = points[0]!.kg;
  const last = points[points.length - 1]!.kg;
  const change = Math.round((last - first) * 10) / 10;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.text}>
        {change === 0 ? "No change" : `${change > 0 ? "+" : ""}${change} kg`} <Text style={styles.muted}>over {points.length} entries</Text>
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, gap: 3 }} accessibilityLabel={`Weight from ${first} to ${last} kilograms`}>
        {points.map((p, i) => (
          <View key={i} style={{ flex: 1, height: 12 + ((p.kg - min) / range) * 84, borderRadius: 4, backgroundColor: colors.primary, opacity: 0.35 + (0.65 * (i + 1)) / points.length }} />
        ))}
      </View>
      <Text style={[styles.muted, { fontSize: 12 }]}>{min} – {max} kg</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const history = useMeasurementHistory();
  const items = history.data?.items ?? [];
  const weights = items
    .filter((m) => typeof m.measurements.weightKg === "number")
    .map((m) => ({ at: m.recordedAt, kg: m.measurements.weightKg as number }))
    .reverse();
  return (
    <Screen>
      <Card title="Morning weight">
        <WeightEntry />
      </Card>
      <Card title="Weight trend">
        <WeightTrend points={weights} />
      </Card>
      <Button title="Log weekly measurements" variant="secondary" onPress={() => router.push("/progress/measurements")} />
      <Card title="History">
        <ErrorNote error={history.error} />
        {items.length ? (
          items.map((m) => (
            <View key={m.id} style={styles.listItem}>
              <Text style={styles.muted}>{new Date(m.recordedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</Text>
              <Text style={styles.listTitle}>
                {Object.entries(m.measurements)
                  .map(([k, v]) => `${LABELS[k] ?? k} ${v} ${unit(k)}`)
                  .join(" · ")}
              </Text>
            </View>
          ))
        ) : (
          <EmptyNote>No measurements yet.</EmptyNote>
        )}
      </Card>
    </Screen>
  );
}
