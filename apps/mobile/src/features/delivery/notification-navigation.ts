import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import { briefingIdFromNotificationData } from "./notification-target";

export const openNotificationBriefing = (
  navigation: Pick<typeof router, "push">,
  response: Notifications.NotificationResponse,
): void => {
  const briefingId = briefingIdFromNotificationData(
    response.notification.request.content.data,
  );
  if (briefingId !== null) {
    navigation.push({
      pathname: "/briefings/[briefingId]",
      params: { briefingId },
    });
  }
};
