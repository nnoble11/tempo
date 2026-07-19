import "react-native-url-polyfill/auto";

import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export class MobileAuthConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MobileAuthConfigurationError";
  }
}

const secureSessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      try {
        return globalThis.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      globalThis.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      globalThis.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let client: SupabaseClient | undefined;

export const getSupabaseClient = (): SupabaseClient => {
  if (client !== undefined) {
    return client;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    supabaseUrl === undefined ||
    supabaseUrl.length === 0 ||
    publishableKey === undefined ||
    publishableKey.length === 0
  ) {
    throw new MobileAuthConfigurationError(
      "Tempo authentication is not configured for this build.",
    );
  }

  client = createClient(supabaseUrl, publishableKey, {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
};

export const getAccessToken = async (): Promise<string | null> => {
  const {
    data: { session },
    error,
  } = await getSupabaseClient().auth.getSession();
  if (error !== null) {
    throw error;
  }
  return session?.access_token ?? null;
};

export type MobileAuthSession = Session;
