import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Card, EmptyNote, ErrorNote, Row, Screen, styles } from "../../../components/ui";
import { useStrengthSummary } from "../../../hooks/useReports";
import { colors } from "../../../theme";

export default function StrengthListScreen() {
  const q = useStrengthSummary();
  return (
    <Screen>
      <Text style={styles.muted}>Estimated one-rep max (Epley) from your best working set each session.</Text>
      <ErrorNote error={q.error} />
      {q.data?.length === 0 && <EmptyNote>Complete workouts to see strength progression.</EmptyNote>}
      {q.data?.map((e) => {
        const change = e.firstOneRepMax > 0 ? Math.round(((e.latestOneRepMax - e.firstOneRepMax) / e.firstOneRepMax) * 100) : 0;
        return (
          <Link key={e.exerciseId} href={{ pathname: "/progress/strength/[id]", params: { id: e.exerciseId } }} asChild>
            <Pressable>
              <Card>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text style={[styles.listTitle, { flex: 1 }]}>{e.exerciseName}</Text>
                  <Text style={styles.statValue}>{e.latestOneRepMax} kg</Text>
                </Row>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text style={styles.muted}>{e.sessions} session{e.sessions === 1 ? "" : "s"} · best {e.bestOneRepMax} kg</Text>
                  {e.sessions > 1 && (
                    <Text style={{ color: change >= 0 ? colors.success : colors.warning }}>
                      {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
                    </Text>
                  )}
                </Row>
              </Card>
            </Pressable>
          </Link>
        );
      })}
      <View />
    </Screen>
  );
}
