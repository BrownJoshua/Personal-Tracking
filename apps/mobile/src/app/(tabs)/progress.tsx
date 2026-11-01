import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BarChart, LineChart, chartColors } from "../../components/charts";
import { Button, Card, Choice, EmptyNote, ErrorNote, Row, Screen, styles } from "../../components/ui";
import { WeightEntry } from "../../components/WeightEntry";
import { useBodyTrend, useTrainingWeeks } from "../../hooks/useReports";
import { colors } from "../../theme";

const RANGES = [
  { value: "30", label: "30 d" },
  { value: "90", label: "90 d" },
  { value: "180", label: "6 mo" },
  { value: "365", label: "1 yr" },
] as const;
type Range = (typeof RANGES)[number]["value"];

const weekLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function ProgressScreen() {
  const [range, setRange] = useState<Range>("90");
  const body = useBodyTrend(Number(range));
  const training = useTrainingWeeks(8);
  const b = body.data;
  const rate = b?.weeklyRateKg;

  return (
    <Screen>
      <Card title="Morning weight">
        <WeightEntry />
      </Card>

      <Row style={{ gap: 12 }}>
        <Link href="/progress/weekly" asChild>
          <Pressable style={{ flex: 1 }}>
            <Card title="Weekly report"><Text style={styles.text}>This week's summary →</Text></Card>
          </Pressable>
        </Link>
        <Link href="/progress/strength" asChild>
          <Pressable style={{ flex: 1 }}>
            <Card title="Strength"><Text style={styles.text}>Lift progression →</Text></Card>
          </Pressable>
        </Link>
      </Row>

      <Choice options={[...RANGES]} value={range} onChange={setRange} />
      <ErrorNote error={body.error} />

      <Card title="Weight">
        {b && b.weight.length > 0 ? (
          <>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <View>
                <Text style={styles.statValue}>{b.weight[b.weight.length - 1]!.average7d.toFixed(1)} kg</Text>
                <Text style={styles.muted}>7-day average</Text>
              </View>
              {rate !== null && rate !== undefined && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.statValue}>{rate > 0 ? "+" : ""}{rate} kg</Text>
                  <Text style={styles.muted}>per week (trend)</Text>
                </View>
              )}
            </Row>
            <LineChart
              unit="kg"
              summary={`Weight from ${b.weight[0]!.valueKg} to ${b.weight[b.weight.length - 1]!.valueKg} kilograms over ${b.weight.length} days; 7-day average ${b.weight[b.weight.length - 1]!.average7d}.`}
              series={[
                { key: "raw", label: "Daily weigh-in", color: chartColors.context, style: "dots", points: b.weight.map((w) => ({ x: w.date, y: w.valueKg })) },
                { key: "avg", label: "7-day average", color: chartColors.series1, style: "line", points: b.weight.map((w) => ({ x: w.date, y: w.average7d })) },
              ]}
            />
            {b.targetWeightKg ? <Text style={styles.muted}>Goal weight {b.targetWeightKg} kg</Text> : null}
          </>
        ) : (
          <EmptyNote>Log a few morning weigh-ins to see your trend.</EmptyNote>
        )}
      </Card>

      <Card title="Waist">
        {b && b.waist.length > 0 ? (
          <LineChart
            unit="cm"
            summary={`Waist from ${b.waist[0]!.valueCm} to ${b.waist[b.waist.length - 1]!.valueCm} centimetres.`}
            series={[{ key: "waist", label: "Waist", color: chartColors.series2, style: "line", points: b.waist.map((w) => ({ x: w.date, y: w.valueCm })) }]}
          />
        ) : (
          <EmptyNote>No waist measurements in this range.</EmptyNote>
        )}
        <Button small variant="secondary" title="Log weekly measurements" onPress={() => router.push("/progress/measurements")} />
      </Card>

      <Card title="Training volume · last 8 weeks">
        <ErrorNote error={training.error} />
        {training.data && training.data.some((w) => w.sessions > 0) ? (
          <>
            <BarChart
              unit="kg"
              summary={`Weekly training volume over 8 weeks: ${training.data.map((w) => Math.round(w.volumeKg)).join(", ")} kilograms.`}
              formatLabel={weekLabel}
              data={training.data.map((w) => ({ label: w.weekStart, value: w.volumeKg }))}
            />
            <Text style={styles.muted}>
              {training.data.reduce((a, w) => a + w.sessions, 0)} workouts · {training.data.reduce((a, w) => a + w.workingSets, 0)} working sets. Tap a bar for the week.
            </Text>
          </>
        ) : (
          <EmptyNote>Complete a workout to start tracking volume.</EmptyNote>
        )}
      </Card>
      <Text style={[styles.muted, { fontSize: 12, color: colors.muted }]}>Cycling and activity from Apple Health/Strava will appear here once connected.</Text>
    </Screen>
  );
}
