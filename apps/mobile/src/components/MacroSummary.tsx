import { Text, View } from "react-native";
import type { NutritionDTO, NutritionTargetDTO } from "@recomptrack/shared";
import { colors, space } from "../theme";
import { ProgressBar, Row, styles } from "./ui";

/** Calories and macros eaten against the day's target. */
export function MacroSummary({ totals, target }: { totals: NutritionDTO; target: NutritionTargetDTO | null }) {
  const left = target ? target.calories - Math.round(totals.calories) : null;
  const macros = [
    { label: "Protein", value: totals.protein, max: target?.protein ?? null, color: colors.protein },
    { label: "Carbs", value: totals.carbohydrates, max: target?.carbohydrates ?? null, color: colors.carbs },
    { label: "Fat", value: totals.fat, max: target?.fat ?? null, color: colors.fat },
    { label: "Fibre", value: totals.fibre, max: target?.fibre ?? null, color: colors.fibre },
  ];
  return (
    <View style={{ gap: space.md }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={styles.bigNumber}>{Math.round(totals.calories)}</Text>
          <Text style={styles.muted}>{target ? `of ${target.calories} kcal` : "kcal eaten"}</Text>
        </View>
        {left !== null && (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.statValue, { color: left < 0 ? colors.warning : colors.primary }]}>{Math.abs(left)}</Text>
            <Text style={styles.muted}>{left < 0 ? "kcal over" : "kcal left"}</Text>
          </View>
        )}
      </Row>
      <ProgressBar value={totals.calories} max={target?.calories ?? null} />
      <Row style={{ gap: space.md, alignItems: "flex-start" }}>
        {macros.map((m) => (
          <View key={m.label} style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.muted, { fontSize: 12 }]}>{m.label}</Text>
            <Text style={[styles.text, { fontWeight: "700" }]}>
              {Math.round(m.value)}
              <Text style={styles.muted}>{m.max ? `/${m.max}` : ""} g</Text>
            </Text>
            <ProgressBar value={m.value} max={m.max} color={m.color} />
          </View>
        ))}
      </Row>
    </View>
  );
}
