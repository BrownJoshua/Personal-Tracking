import { Text, View } from "react-native";
import { ageOn, enumLabel } from "@recomptrack/shared";
import { Button, Card, Screen, styles } from "../../components/ui";
import { useAuth } from "../../store/auth";
import { colors, space } from "../../theme";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.row, { justifyContent: "space-between", paddingVertical: 6 }]}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.listTitle}>{value}</Text>
    </View>
  );
}

const INTEGRATIONS = [
  { name: "Apple Health", status: "Not connected", note: "Steps, workouts, sleep, heart rate" },
  { name: "Strava", status: "Not connected", note: "Rides and activities" },
  { name: "HealthifyMe", status: "Import not configured", note: "File import / manual entry" },
];

export default function ProfileScreen() {
  const { me, signOut } = useAuth();
  if (!me) return null;
  const p = me.profile;
  return (
    <Screen>
      <Card title="Account">
        <Text style={styles.listTitle}>{me.user.name}</Text>
        <Text style={styles.muted}>{me.user.email}</Text>
      </Card>
      <Card title="Profile">
        <Row label="Age" value={p.dateOfBirth ? `${ageOn(p.dateOfBirth)}` : "—"} />
        <Row label="Height" value={p.heightCm ? `${p.heightCm} cm` : "—"} />
        <Row label="Activity level" value={p.activityLevel ? enumLabel(p.activityLevel) : "—"} />
        <Row label="Experience" value={p.trainingExperience ? enumLabel(p.trainingExperience) : "—"} />
        <Row label="Goal" value={me.goal ? enumLabel(me.goal.goalType) : "—"} />
        <Row label="Target weight" value={me.goal?.targetWeightKg ? `${me.goal.targetWeightKg} kg` : "—"} />
      </Card>
      <Card title="Privacy">
        <Row label="Share progress with admin" value={me.preferences.sharing.shareProgressWithAdmin ? "On" : "Off"} />
        <Row label="Share nutrition with admin" value={me.preferences.sharing.shareNutritionWithAdmin ? "On" : "Off"} />
      </Card>
      <Card title="Integrations">
        {INTEGRATIONS.map((i) => (
          <View key={i.name} style={[styles.listItem, { gap: 2 }]}>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={styles.listTitle}>{i.name}</Text>
              <Text style={{ color: colors.muted }}>{i.status}</Text>
            </View>
            <Text style={styles.muted}>{i.note} · available in a later release</Text>
          </View>
        ))}
      </Card>
      <View style={{ marginTop: space.sm }}>
        <Button title="Sign out" variant="danger" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
