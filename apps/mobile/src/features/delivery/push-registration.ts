import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { upsertDeliveryEndpoint } from "./api";
import {
  registerPushEndpointWith,
  type PushRegistrationResult,
} from "./push-registration-core";

export type { PushRegistrationResult } from "./push-registration-core";

export const registerPushEndpoint = (): Promise<PushRegistrationResult> =>
  registerPushEndpointWith({
    supported: Platform.OS !== "web" && Device.isDevice,
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    getPermissionStatus: async () =>
      (await Notifications.getPermissionsAsync()).status,
    requestPermission: async () =>
      (await Notifications.requestPermissionsAsync()).status,
    getToken: async (projectId) =>
      (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data,
    upsert: async (destination) => {
      await upsertDeliveryEndpoint({
        channel: "push",
        destination,
        enabled: true,
      });
    },
  });
