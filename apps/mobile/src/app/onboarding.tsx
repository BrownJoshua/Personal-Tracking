import { useState } from "react";
import { Text } from "react-native";
import {
  ACTIVITY_LEVELS,
  EXPERIENCE_LEVELS,
  GOAL_TYPES,
  SEXES,
  assessmentSchema,
  firstFieldErrors,
  enumLabel,
  type ActivityLevel,
  type ExperienceLevel,
  type GoalType,
  type MeDTO,
  type Sex,
} from "@recomptrack/shared";
import { Button, Card, Choice, ErrorNote, Screen, TextField, styles } from "../components/ui";
import { ApiError, api } from "../services/api";
import { useAuth } from "../store/auth";

const opts = <T extends string>(values: readonly T[]) => values.map((v) => ({ value: v, label: enumLabel(v) }));
const toNum = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

export default function OnboardingScreen() {
  const { setMe, signOut } = useAuth();
  const [dob, setDob] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [goal, setGoal] = useState<GoalType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const body = {
      profile: {
        dateOfBirth: dob.trim() || null,
        heightCm: toNum(height) ?? null,
        sex,
        activityLevel: activity,
        trainingExperience: experience,
      },
      currentWeightKg: toNum(weight),
      waistCm: toNum(waist),
      bodyFatPercent: toNum(bodyFat),
      goal: goal ? { goalType: goal, targetWeightKg: toNum(targetWeight) ?? null } : undefined,
    };
    const parsed = assessmentSchema.safeParse(body);
    const missing: Record<string, string> = {};
    if (!goal) missing["goal.goalType"] = "Choose a goal";
    if (!parsed.success || Object.keys(missing).length) {
      setErrors({ ...(parsed.error ? firstFieldErrors(parsed.error) : {}), ...missing });
      return;
    }
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      setMe(await api<MeDTO>("/users/me/assessment", { method: "POST", body: parsed.data }));
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(e.fieldErrors());
      else setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.muted}>
        This sets up your starting point. Body values are saved as your first measurement, so later updates never overwrite history.
      </Text>
      <Card title="About you">
        <TextField label="Date of birth" placeholder="YYYY-MM-DD" value={dob} onChangeText={setDob} error={errors["profile.dateOfBirth"]} keyboardType="numbers-and-punctuation" />
        <TextField label="Height (cm)" keyboardType="decimal-pad" value={height} onChangeText={setHeight} error={errors["profile.heightCm"]} />
        <Choice label="Sex (used by calorie equations)" options={opts(SEXES)} value={sex} onChange={setSex} />
        <Choice label="Activity level" options={opts(ACTIVITY_LEVELS)} value={activity} onChange={setActivity} />
        <Choice label="Training experience" options={opts(EXPERIENCE_LEVELS)} value={experience} onChange={setExperience} />
      </Card>
      <Card title="Today">
        <TextField label="Current weight (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} error={errors.currentWeightKg} />
        <TextField label="Waist (cm)" keyboardType="decimal-pad" value={waist} onChangeText={setWaist} error={errors.waistCm} hint="Optional" />
        <TextField label="Body-fat estimate (%)" keyboardType="decimal-pad" value={bodyFat} onChangeText={setBodyFat} error={errors.bodyFatPercent} hint="Optional" />
      </Card>
      <Card title="Goal">
        <Choice label="Main goal" options={opts(GOAL_TYPES)} value={goal} onChange={setGoal} error={errors["goal.goalType"]} />
        <TextField label="Target weight (kg)" keyboardType="decimal-pad" value={targetWeight} onChangeText={setTargetWeight} error={errors["goal.targetWeightKg"]} hint="Optional" />
      </Card>
      <ErrorNote error={error} />
      <Button title="Save and continue" onPress={submit} loading={busy} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
