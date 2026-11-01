import { Text, View } from "react-native";
import { addDays } from "@recomptrack/shared";
import { Card, ErrorNote, Row, Screen, Stat, styles } from "../../components/ui";
import { useNutritionHistory, useTargets } from "../../hooks/useNutrition";
import { colors, space } from "../../theme";

export default function NutritionHistoryScreen() {
  const history = useNutritionHistory();
  const targets = useTargets();
  const days = history.data ?? [];
  const logged = days.filter((d) => d.entries > 0);
  const avg = (k: "calories" | "protein") => (logged.length ? Math.round(logged.reduce((a, d) => a + d.totals[k], 0) / logged.length) : null);
  const target = targets.data?.target;
  const maxKcal = Math.max(target?.calories ?? 0, ...days.map((d) => d.totals.calories), 1);

  return (
    <Screen>
      <ErrorNote error={history.error} />
      <Card title="Last 7 days">
        <Row style={{ gap: space.md }}>
          <Stat label="Avg calories" value={avg("calories")?.toString() ?? "—"} sub={target ? `target ${target.calories}` : undefined} />
          <Stat label="Avg protein" value={avg("protein") !== null ? `${avg("protein")} g` : "—"} sub={target ? `target ${target.protein} g` : undefined} />
          <Stat label="Days logged" value={`${logged.length}/7`} />
        </Row>
        <Text style={[styles.muted, { fontSize: 12 }]}>Averages use logged days only — unlogged days are not counted as zero.</Text>
      </Card>
      <Card title="By day">
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 140, gap: 6 }} accessibilityLabel="Calories per day chart">
          {days.map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: "100%",
                  height: Math.max(2, (d.totals.calories / maxKcal) * 110),
                  borderRadius: 6,
                  backgroundColor: d.entries ? colors.primary : "rgba(255,255,255,0.1)",
                  opacity: d.entries ? 0.9 : 1,
                }}
              />
              <Text style={[styles.muted, { fontSize: 11 }]}>{new Date(`${d.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "narrow" })}</Text>
            </View>
          ))}
        </View>
        {days
          .slice()
          .reverse()
          .map((d) => (
            <Row key={d.date} style={[styles.listItem, { justifyContent: "space-between" }]}>
              <Text style={styles.text}>{d.date === days[days.length - 1]?.date ? "Today" : d.date === addDays(days[days.length - 1]?.date ?? d.date, -1) ? "Yesterday" : d.date}</Text>
              <Text style={styles.muted}>{d.entries ? `${Math.round(d.totals.calories)} kcal · P ${Math.round(d.totals.protein)} g` : "Not logged"}</Text>
            </Row>
          ))}
      </Card>
    </Screen>
  );
}
