import type { DeliveryEndpoint, UserPreferences } from "@tempo/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../auth/AuthProvider";
import { darkPalette, lightPalette, type TempoPalette } from "../../theme";
import { updatePreferences } from "./api";
import { profileQueryKey, useProfile } from "./hooks";
import {
  confirmDeliveryEndpointVerification,
  disableDeliveryEndpoint,
  fetchDeliveryEndpoints,
  requestDeliveryEndpointVerification,
  upsertDeliveryEndpoint,
} from "../delivery/api";

export function SettingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const palette = useColorScheme() === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const profile = useProfile(session?.user.id ?? null);
  const endpoints = useQuery({
    queryKey: ["delivery-endpoints"],
    queryFn: fetchDeliveryEndpoints,
  });
  const preferences = profile.data?.preferences;
  const [quietStart, setQuietStart] = useState(
    preferences?.quietHoursStart ?? "22:00",
  );
  const [quietEnd, setQuietEnd] = useState(
    preferences?.quietHoursEnd ?? "07:00",
  );
  const [destination, setDestination] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshEndpoints = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["delivery-endpoints"] });
  };

  const saveQuietHours = async (): Promise<void> => {
    if (preferences === undefined || session === null) {
      return;
    }
    setBusy(true);
    try {
      const updated = await updatePreferences({
        ...preferenceInput(preferences),
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd,
      });
      queryClient.setQueryData(profileQueryKey(session.user.id), {
        ...profile.data,
        preferences: updated,
      });
      setMessage("Quiet hours saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const addDestination = async (): Promise<void> => {
    setBusy(true);
    try {
      const endpoint = await upsertDeliveryEndpoint({
        channel,
        destination,
        enabled: true,
      });
      setDestination("");
      await refreshEndpoints();
      setMessage(
        endpoint.verificationStatus === "verified"
          ? "Destination added and verified."
          : "Destination added. Send a verification code to activate it.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add.");
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async (endpoint: DeliveryEndpoint): Promise<void> => {
    setBusy(true);
    try {
      await requestDeliveryEndpointVerification(endpoint.id);
      setMessage(`A code was sent to ${endpoint.destination}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (endpoint: DeliveryEndpoint): Promise<void> => {
    setBusy(true);
    try {
      await confirmDeliveryEndpointVerification(
        endpoint.id,
        codes[endpoint.id] ?? "",
      );
      await refreshEndpoints();
      setMessage("Destination verified.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  const disableDestination = async (
    endpoint: DeliveryEndpoint,
  ): Promise<void> => {
    setBusy(true);
    try {
      await disableDeliveryEndpoint(endpoint.id);
      await refreshEndpoints();
      setMessage(`${endpoint.destination} disabled.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disable.");
    } finally {
      setBusy(false);
    }
  };

  if (preferences === undefined || endpoints.isPending) {
    return (
      <SafeAreaView style={styles.state}>
        <ActivityIndicator color={palette.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Today</Text>
        </Pressable>
        <Text style={styles.eyebrow}>DELIVERY CONTROL</Text>
        <Text style={styles.title}>Your briefing, on your terms.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quiet hours</Text>
          <Text style={styles.help}>
            External messages wait until this local-time window ends.
          </Text>
          <View style={styles.row}>
            <TextInput
              accessibilityLabel="Quiet hours start"
              onChangeText={setQuietStart}
              style={styles.input}
              value={quietStart}
            />
            <Text style={styles.help}>to</Text>
            <TextInput
              accessibilityLabel="Quiet hours end"
              onChangeText={setQuietEnd}
              style={styles.input}
              value={quietEnd}
            />
          </View>
          <Action
            label="Save quiet hours"
            disabled={busy}
            onPress={saveQuietHours}
            styles={styles}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verified destinations</Text>
          <View style={styles.row}>
            {(["email", "sms"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setChannel(value)}
                style={[styles.chip, channel === value && styles.chipSelected]}
              >
                <Text style={styles.chipText}>{value.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            autoCapitalize="none"
            keyboardType={channel === "email" ? "email-address" : "phone-pad"}
            onChangeText={setDestination}
            placeholder={
              channel === "email" ? "you@example.com" : "+14155550123"
            }
            placeholderTextColor={palette.textMuted}
            style={styles.fullInput}
            value={destination}
          />
          <Action
            label="Add destination"
            disabled={busy || destination.length === 0}
            onPress={addDestination}
            styles={styles}
          />
          {endpoints.isError ? (
            <View style={styles.endpoint}>
              <Text accessibilityRole="alert" style={styles.endpointError}>
                Your destinations could not be loaded.{" "}
                {endpoints.error instanceof Error
                  ? endpoints.error.message
                  : "Check your connection and try again."}
              </Text>
              <Action
                label="Retry"
                disabled={endpoints.isRefetching}
                onPress={() => void endpoints.refetch()}
                styles={styles}
              />
            </View>
          ) : null}
          {endpoints.data?.map((endpoint) => (
            <View key={endpoint.id} style={styles.endpoint}>
              <View style={styles.endpointCopy}>
                <Text style={styles.endpointValue}>{endpoint.destination}</Text>
                <Text style={styles.help}>
                  {endpoint.channel.toUpperCase()} ·{" "}
                  {endpoint.verificationStatus}
                </Text>
              </View>
              {endpoint.verificationStatus === "pending" ? (
                <View style={styles.verify}>
                  <Action
                    label="Send code"
                    disabled={busy}
                    onPress={() => requestCode(endpoint)}
                    styles={styles}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(code) =>
                      setCodes((current) => ({
                        ...current,
                        [endpoint.id]: code,
                      }))
                    }
                    placeholder="000000"
                    placeholderTextColor={palette.textMuted}
                    style={styles.codeInput}
                    value={codes[endpoint.id] ?? ""}
                  />
                  <Action
                    label="Verify"
                    disabled={busy || (codes[endpoint.id]?.length ?? 0) !== 6}
                    onPress={() => confirmCode(endpoint)}
                    styles={styles}
                  />
                </View>
              ) : null}
              <Action
                label="Disable"
                disabled={busy}
                onPress={() => disableDestination(endpoint)}
                styles={styles}
              />
            </View>
          ))}
        </View>
        {message === null ? null : (
          <Text style={styles.message}>{message}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const preferenceInput = (preferences: UserPreferences) => ({
  timezone: preferences.timezone,
  locale: preferences.locale,
  defaultBriefingMinutes: preferences.defaultBriefingMinutes,
  dailyBriefingTime: preferences.dailyBriefingTime,
  quietHoursStart: preferences.quietHoursStart,
  quietHoursEnd: preferences.quietHoursEnd,
  deliveryChannels: preferences.deliveryChannels,
  calendarSuggestionsEnabled: preferences.calendarSuggestionsEnabled,
  recommendationsEnabled: preferences.recommendationsEnabled,
});

function Action({
  label,
  disabled,
  onPress,
  styles,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => void onPress()}
      style={styles.action}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    safeArea: { backgroundColor: palette.background, flex: 1 },
    state: {
      backgroundColor: palette.background,
      flex: 1,
      justifyContent: "center",
    },
    content: { gap: 20, padding: 24, paddingBottom: 60 },
    back: { color: palette.accent, fontSize: 16, fontWeight: "700" },
    eyebrow: {
      color: palette.accent,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    title: {
      color: palette.text,
      fontSize: 32,
      fontWeight: "800",
      lineHeight: 39,
    },
    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 14,
      padding: 20,
    },
    cardTitle: { color: palette.text, fontSize: 21, fontWeight: "800" },
    help: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
    row: { alignItems: "center", flexDirection: "row", gap: 10 },
    input: {
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderRadius: 10,
      borderWidth: 1,
      color: palette.text,
      fontSize: 16,
      padding: 12,
      width: 90,
    },
    fullInput: {
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderRadius: 10,
      borderWidth: 1,
      color: palette.text,
      fontSize: 16,
      padding: 12,
    },
    chip: {
      borderColor: palette.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    chipSelected: { backgroundColor: palette.accent },
    chipText: { color: palette.text, fontSize: 12, fontWeight: "800" },
    action: {
      alignSelf: "flex-start",
      backgroundColor: palette.accent,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    actionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    endpoint: {
      borderTopColor: palette.border,
      borderTopWidth: 1,
      gap: 12,
      paddingTop: 14,
    },
    endpointCopy: { gap: 3 },
    endpointValue: { color: palette.text, fontSize: 15, fontWeight: "700" },
    verify: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    codeInput: {
      borderColor: palette.border,
      borderRadius: 8,
      borderWidth: 1,
      color: palette.text,
      letterSpacing: 2,
      padding: 9,
      width: 90,
    },
    message: { color: palette.accent, fontSize: 14, fontWeight: "700" },
    endpointError: {
      color: palette.text,
      fontSize: 13,
      lineHeight: 18,
    },
  });
