import { Text, View } from "react-native";
import { Card, EmptyNote, ErrorNote, Screen, styles } from "../../components/ui";
import { WeightEntry } from "../../components/WeightEntry";
import { useMeasurementHistory } from "../../hooks/useMeasurements";
import { space } from "../../theme";

const LABELS: Record<string, string> = {
  weightKg: "Weight",
  bodyFatPercent: "Body fat",
  waistCm: "Waist",
};
const unit = (k: string) => (k === "weightKg" ? "kg" : k === "bodyFatPercent" ? "%" : "cm");

export default function ProgressScreen() {
  const history = useMeasurementHistory();
  return (
    <Screen>
      <Card title="Morning weight">
        <WeightEntry />
      </Card>
      <Card title="History">
        <ErrorNote error={history.error} />
        {history.data?.items.length ? (
          history.data.items.map((m) => (
            <View key={m.id} style={styles.listItem}>
              <Text style={styles.muted}>{new Date(m.recordedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</Text>
              <Text style={styles.listTitle}>
                {Object.entries(m.measurements)
                  .map(([k, v]) => `${LABELS[k] ?? k.replace(/Cm$/, "")} ${v} ${unit(k)}`)
                  .join(" · ")}
              </Text>
            </View>
          ))
        ) : (
          <EmptyNote>No measurements yet.</EmptyNote>
        )}
      </Card>
      <Card title="Coming next">
        <Text style={[styles.muted, { marginBottom: space.xs }]}>
          Weight and waist charts, weekly measurements, strength and nutrition analytics, and private progress photos.
        </Text>
      </Card>
    </Screen>
  );
}
