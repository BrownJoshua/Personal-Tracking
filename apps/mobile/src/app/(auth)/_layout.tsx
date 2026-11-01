import { Stack } from "expo-router";
import { colors } from "../../theme";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
    </Stack>
  );
}
