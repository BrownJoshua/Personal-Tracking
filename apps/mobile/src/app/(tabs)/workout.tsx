import { Link, router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { WEEKDAY_NAMES, formatDuration } from "@recomptrack/shared";
import { Button, Card, EmptyNote, ErrorNote, Row, Screen, styles } from "../../components/ui";
import { useHistory, useStartSession, useToday } from "../../hooks/useWorkouts";
import { ApiError } from "../../services/api";
import { colors, space } from "../../theme";

const REASON_TEXT: Record<string, string> = {
  NO_PLAN: "No plan assigned yet. You can still log a free workout.",
  NOT_STARTED: "Your plan starts soon.",
  REST_DAY: "Rest day — recovery is part of the plan.",
  DONE_TODAY: "Done for today. Nice work!",
};

export default function WorkoutScreen() {
  const today = useToday();
  const history = useHistory(3);
  const start = useStartSession();
  const t = today.data;

  function begin(dayId?: string) {
    start.mutate(dayId, {
      onSuccess: () => router.push("/workout/active"),
      onError: (e) => {
        if (e instanceof ApiError && e.code === "SESSION_IN_PROGRESS") router.push("/workout/active");
        else Alert.alert("Could not start workout", e.message);
      },
    });
  }

  return (
    <Screen>
      <ErrorNote error={today.error} />
      {t?.activeSessionId && (
        <Card title="In progress">
          <Text style={styles.listTitle}>You have an unfinished workout.</Text>
          <Button title="Resume workout" onPress={() => router.push("/workout/active")} />
        </Card>
      )}

      <Card title="Today" right={t?.day?.weekday ? <Text style={styles.muted}>{WEEKDAY_NAMES[t.day.weekday - 1]}</Text> : undefined}>
        {t?.day && t.reason !== "DONE_TODAY" ? (
          <>
            <Text style={styles.h2}>{t.day.dayName}</Text>
            {t.day.exercises.map((e) => (
              <Row key={e.exerciseId} style={{ justifyContent: "space-between" }}>
                <Text style={[styles.text, { flex: 1 }]}>{e.exerciseName}</Text>
                <Text style={styles.muted}>{e.sets} × {e.repMin}–{e.repMax}</Text>
              </Row>
            ))}
            {!t.activeSessionId && <Button title="Start workout" onPress={() => begin(t.day!.id)} loading={start.isPending} />}
          </>
        ) : (
          <>
            {t?.reason === "DONE_TODAY" && t.day && <Text style={styles.h2}>{t.day.dayName} ✓</Text>}
            <EmptyNote>
              {t ? (t.reason === "NOT_STARTED" ? `Your plan starts on ${t.startsOn}.` : REASON_TEXT[t.reason]) : "Loading…"}
            </EmptyNote>
          </>
        )}
        {!t?.activeSessionId && <Button title="Log a free workout" variant="secondary" onPress={() => begin()} loading={start.isPending && !t?.day} />}
      </Card>

      <Row style={{ gap: space.md }}>
        <Link href="/workout/plan" asChild>
          <Pressable style={{ flex: 1 }}>
            <Card title="My plan"><Text style={styles.text}>Days, sets and reps →</Text></Card>
          </Pressable>
        </Link>
        <Link href="/exercises" asChild>
          <Pressable style={{ flex: 1 }}>
            <Card title="Library"><Text style={styles.text}>All exercises →</Text></Card>
          </Pressable>
        </Link>
      </Row>

      <Card title="Recent workouts" right={<Link href="/workout/history" style={{ color: colors.primary }}>See all</Link>}>
        {history.data?.items.length ? (
          history.data.items.map((s) => (
            <Link key={s.id} href={{ pathname: "/workout/[id]", params: { id: s.id } }} asChild>
              <Pressable style={styles.listItem}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text style={styles.listTitle}>{s.title}</Text>
                  <Text style={styles.muted}>{new Date(s.completedAt ?? s.startedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</Text>
                </Row>
                {s.summary && (
                  <Text style={styles.muted}>
                    {formatDuration(s.summary.durationSeconds)} · {s.summary.workingSets} sets · {Math.round(s.summary.volumeKg)} kg
                    {s.summary.personalRecords.length ? ` · ${s.summary.personalRecords.length} PR` : ""}
                  </Text>
                )}
              </Pressable>
            </Link>
          ))
        ) : (
          <EmptyNote>No completed workouts yet.</EmptyNote>
        )}
      </Card>
    </Screen>
  );
}
