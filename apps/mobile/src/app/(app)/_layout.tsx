import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { useColorScheme, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import { AppNavigation } from "../../components/AppNavigation";
import { useProfile } from "../../features/account/hooks";
import { usePushRegistration } from "../../features/delivery/hooks";
import { openNotificationBriefing } from "../../features/delivery/notification-navigation";
import { darkPalette, lightPalette } from "../../theme";

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

export default function AuthenticatedLayout() {
  const { session } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = colorScheme === "dark" ? darkPalette : lightPalette;
  const screenOptions = useMemo(
    () => ({
      animation: "fade" as const,
      contentStyle: { backgroundColor: palette.background },
      headerShown: false,
    }),
    [palette.background],
  );
  const profile = useProfile(session?.user.id ?? null);
  usePushRegistration(
    profile.data?.preferences.deliveryChannels.includes("push") ?? false,
  );
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => openNotificationBriefing(router, response),
    );
    const response = Notifications.getLastNotificationResponse();
    if (response !== null) {
      openNotificationBriefing(router, response);
    }
    return () => subscription.remove();
  }, [router]);
  return (
    <View style={{ backgroundColor: palette.background, flex: 1 }}>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen
          name="briefings/[briefingId]"
          options={{
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
      </Stack>
      <AppNavigation palette={palette} variant="primary" />
    </View>
  );
}
