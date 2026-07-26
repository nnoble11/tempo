import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { upsertDeliveryEndpoint } from "./api";

export type PushRegistrationResult =
  "registered" | "unsupported" | "not_configured" | "permission_denied";

export const registerPushEndpoint =
  async (): Promise<PushRegistrationResult> => {
    if (Platform.OS === "web" || !Device.isDevice) {
      return "unsupported";
    }
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (projectId === undefined || projectId.length === 0) {
      return "not_configured";
    }

    const currentPermissions = await Notifications.getPermissionsAsync();
    const permissions =
      currentPermissions.status === Notifications.PermissionStatus.GRANTED
        ? currentPermissions
        : await Notifications.requestPermissionsAsync();
    if (permissions.status !== Notifications.PermissionStatus.GRANTED) {
      return "permission_denied";
    }

    const { data: destination } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    await upsertDeliveryEndpoint({
      channel: "push",
      destination,
      enabled: true,
    });
    return "registered";
  };
