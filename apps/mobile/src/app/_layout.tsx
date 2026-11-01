import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Backdrop, headerOptions } from "../components/ui";
import { ApiError } from "../services/api";
import { AuthProvider, useAuth } from "../store/auth";
import { colors } from "../theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 2 },
  },
});

function RootNavigator() {
  const { me, ready } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Backdrop />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const signedIn = !!me;
  const onboarded = !!me?.user.onboardingCompleted;
  // Where a blocked route sends the user: sign-in, then onboarding, then the app.
  const home = !signedIn ? "/login" : !onboarded ? "/onboarding" : "/";
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Protected guard={!signedIn} redirectTo={home}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded} redirectTo={home}>
        <Stack.Screen name="onboarding" options={{ title: "Personal assessment", headerBackVisible: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded} redirectTo={home}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="exercises" options={{ title: "Exercise library" }} />
        <Stack.Screen name="exercise/[id]" options={{ title: "Exercise" }} />
        <Stack.Screen name="food/[id]" options={{ title: "Food" }} />
        <Stack.Screen name="workout/plan" options={{ title: "My plan" }} />
        <Stack.Screen name="workout/active" options={{ title: "Workout", gestureEnabled: false }} />
        <Stack.Screen name="workout/history" options={{ title: "Workout history" }} />
        <Stack.Screen name="workout/[id]" options={{ title: "Workout summary" }} />
        <Stack.Screen name="nutrition/add" options={{ title: "Add food" }} />
        <Stack.Screen name="nutrition/custom-food" options={{ title: "New custom food", presentation: "modal" }} />
        <Stack.Screen name="nutrition/history" options={{ title: "Nutrition history" }} />
        <Stack.Screen name="progress/measurements" options={{ title: "Body measurements" }} />
        <Stack.Screen name="progress/weekly" options={{ title: "Weekly report" }} />
        <Stack.Screen name="progress/strength/index" options={{ title: "Strength" }} />
        <Stack.Screen name="progress/strength/[id]" options={{ title: "Strength" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
