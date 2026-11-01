import { Link } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { formatDuration } from "@recomptrack/shared";
import { Backdrop, Card, EmptyNote, ErrorNote, Row, styles } from "../../components/ui";
import { useHistory } from "../../hooks/useWorkouts";
import { space } from "../../theme";

export default function HistoryScreen() {
  const q = useHistory(50);
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <FlatList
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        ListHeaderComponent={<ErrorNote error={q.error} />}
        data={q.data?.items ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item: s }) => (
          <Link href={{ pathname: "/workout/[id]", params: { id: s.id } }} asChild>
            <Pressable>
              <Card>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text style={styles.listTitle}>{s.title}</Text>
                  <Text style={styles.muted}>{new Date(s.completedAt ?? s.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</Text>
                </Row>
                {s.summary && (
                  <Text style={styles.muted}>
                    {formatDuration(s.summary.durationSeconds)} · {s.summary.exercises} exercises · {s.summary.workingSets} sets · {Math.round(s.summary.volumeKg)} kg
                    {s.summary.personalRecords.length ? ` · 🏆 ${s.summary.personalRecords.length}` : ""}
                  </Text>
                )}
              </Card>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={q.isLoading ? undefined : <EmptyNote>No completed workouts yet.</EmptyNote>}
      />
    </View>
  );
}
