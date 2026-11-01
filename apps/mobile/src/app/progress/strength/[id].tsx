import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { BarChart, LineChart, chartColors } from "../../../components/charts";
import { Card, Choice, EmptyNote, ErrorNote, Row, Screen, Stat, styles } from "../../../components/ui";
import { useStrengthSeries } from "../../../hooks/useReports";

const RANGES = [
  { value: "90", label: "3 mo" },
  { value: "180", label: "6 mo" },
  { value: "365", label: "1 yr" },
] as const;

export default function StrengthDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [range, setRange] = useState<"90" | "180" | "365">("180");
  const q = useStrengthSeries(id, Number(range));
  const s = q.data;
  const pts = s?.points ?? [];
  const best = pts.length ? Math.max(...pts.map((p) => p.bestOneRepMax)) : 0;
  return (
    <Screen>
      <Stack.Screen options={{ title: s?.exerciseName ?? "Strength" }} />
      <Choice options={[...RANGES]} value={range} onChange={setRange} />
      <ErrorNote error={q.error} />
      {pts.length === 0 ? (
        q.isSuccess && <EmptyNote>No completed sessions in this range.</EmptyNote>
      ) : (
        <>
          <Card title="Summary">
            <Row style={{ gap: 12 }}>
              <Stat label="Latest e1RM" value={`${pts[pts.length - 1]!.bestOneRepMax} kg`} />
              <Stat label="Best e1RM" value={`${best} kg`} />
              <Stat label="Sessions" value={String(pts.length)} />
            </Row>
          </Card>
          <Card title="Estimated 1RM">
            <LineChart
              unit="kg"
              summary={`Estimated one-rep max from ${pts[0]!.bestOneRepMax} to ${pts[pts.length - 1]!.bestOneRepMax} kilograms over ${pts.length} sessions.`}
              series={[{ key: "e1rm", label: "Estimated 1RM", color: chartColors.series1, style: "line", points: pts.map((p) => ({ x: p.date, y: p.bestOneRepMax })) }]}
            />
          </Card>
          <Card title="Heaviest working set">
            <LineChart
              unit="kg"
              summary={`Heaviest working weight from ${pts[0]!.heaviestKg} to ${pts[pts.length - 1]!.heaviestKg} kilograms.`}
              series={[{ key: "heavy", label: "Heaviest set", color: chartColors.series2, style: "line", points: pts.map((p) => ({ x: p.date, y: p.heaviestKg })) }]}
            />
          </Card>
          <Card title="Volume per session">
            <BarChart
              unit="kg"
              summary={`Volume per session: ${pts.map((p) => Math.round(p.volumeKg)).join(", ")} kilograms.`}
              formatLabel={(d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              data={pts.map((p) => ({ label: p.date, value: p.volumeKg }))}
            />
          </Card>
          <Text style={[styles.muted, { fontSize: 12 }]}>e1RM uses the Epley formula and is an estimate, not a tested max.</Text>
        </>
      )}
    </Screen>
  );
}
