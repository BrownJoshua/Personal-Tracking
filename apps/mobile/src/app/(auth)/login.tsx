import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button, ErrorNote, Screen, TextField, styles } from "../../components/ui";
import { useAuth } from "../../store/auth";
import { colors, space } from "../../theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ marginTop: 80, marginBottom: space.xl, gap: space.xs }}>
          <Text style={styles.h1}>
            Recomp<Text style={{ color: colors.primary }}>Track</Text>
          </Text>
          <Text style={styles.muted}>Nutrition, training and progress in one place.</Text>
        </View>
        <TextField label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" value={email} onChangeText={setEmail} />
        <TextField label="Password" secureTextEntry autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        <ErrorNote error={error} />
        <Button title="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
        <View style={{ gap: space.md, alignItems: "center", marginTop: space.lg }}>
          <Link href="/forgot-password" style={{ color: colors.primary }}>Forgot password?</Link>
          <Link href="/register" style={{ color: colors.primary, fontWeight: "600" }}>New here? Create an account</Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
