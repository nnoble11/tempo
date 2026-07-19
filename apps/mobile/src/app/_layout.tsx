import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
  type AppStateStatus,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { useProfile } from "../features/account/hooks";
import { darkPalette, lightPalette } from "../theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

const onAppStateChange = (status: AppStateStatus): void => {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SessionNavigator />
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function SessionNavigator() {
  const colorScheme = useColorScheme();
  const palette = colorScheme === "dark" ? darkPalette : lightPalette;
  const { session, isLoading, signOut } = useAuth();
  const profile = useProfile(session?.user.id ?? null);

  if (isLoading || (session !== null && profile.isPending)) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.background,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (session !== null && profile.isError) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.background,
          flex: 1,
          justifyContent: "center",
          padding: 28,
        }}
      >
        <Text
          style={{
            color: palette.text,
            fontSize: 22,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          Tempo couldn’t load your account.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void profile.refetch()}
          style={{ padding: 16 }}
        >
          <Text style={{ color: palette.accent, fontWeight: "700" }}>
            Try again
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={{ padding: 10 }}
        >
          <Text style={{ color: palette.textMuted }}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  const onboardingComplete =
    profile.data?.user.onboardingCompletedAt !== null &&
    profile.data?.user.onboardingCompletedAt !== undefined;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={session !== null && !onboardingComplete}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={session !== null && onboardingComplete}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
