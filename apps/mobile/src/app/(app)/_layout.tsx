import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "../../auth/AuthProvider";
import { useProfile } from "../../features/account/hooks";
import { usePushRegistration } from "../../features/delivery/hooks";
import { openNotificationBriefing } from "../../features/delivery/notification-navigation";

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
  return <Stack screenOptions={{ headerShown: false }} />;
}
