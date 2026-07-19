import * as Notifications from "expo-notifications";
import { router } from "expo-router";

const briefingIdFromResponse = (
  response: Notifications.NotificationResponse,
): string | null => {
  const value = response.notification.request.content.data?.briefingId;
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
};

export const openNotificationBriefing = (
  navigation: Pick<typeof router, "push">,
  response: Notifications.NotificationResponse,
): void => {
  const briefingId = briefingIdFromResponse(response);
  if (briefingId !== null) {
    navigation.push({
      pathname: "/briefings/[briefingId]",
      params: { briefingId },
    });
  }
};
