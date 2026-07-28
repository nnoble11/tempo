import type { DeliveryEndpoint, UserPreferences } from "@tempo/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { AppNavigation } from "../../components/AppNavigation";
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
import { registerPushEndpoint } from "../delivery/push-registration";

export function SettingsScreen() {
  const { session } = useAuth();
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
  const [dailyTime, setDailyTime] = useState(
    preferences?.dailyBriefingTime ?? "08:00",
  );
  const [timezone, setTimezone] = useState(
    preferences?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [destination, setDestination] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preferences === undefined) return;
    setQuietStart(preferences.quietHoursStart ?? "22:00");
    setQuietEnd(preferences.quietHoursEnd ?? "07:00");
    setDailyTime(preferences.dailyBriefingTime);
    setTimezone(preferences.timezone);
  }, [preferences?.updatedAt]);

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

  const saveSchedule = async (): Promise<void> => {
    if (preferences === undefined || session === null) return;
    setBusy(true);
    try {
      const updated = await updatePreferences({
        ...preferenceInput(preferences),
        dailyBriefingTime: dailyTime,
        timezone,
      });
      queryClient.setQueryData(profileQueryKey(session.user.id), {
        ...profile.data,
        preferences: updated,
      });
      setMessage("Daily delivery schedule saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save schedule.",
      );
    } finally {
      setBusy(false);
    }
  };

  const togglePush = async (): Promise<void> => {
    if (preferences === undefined || session === null) return;
    const enabled = preferences.deliveryChannels.includes("push");
    setBusy(true);
    try {
      if (!enabled) {
        const registration = await registerPushEndpoint();
        if (registration !== "registered") {
          setMessage(
            registration === "permission_denied"
              ? "Push permission was denied. You can enable it in iOS Settings."
              : "Push registration requires a configured physical iPhone build.",
          );
          return;
        }
      } else {
        const pushEndpoints =
          endpoints.data?.filter(({ channel }) => channel === "push") ?? [];
        await Promise.all(
          pushEndpoints.map(({ id }) => disableDeliveryEndpoint(id)),
        );
      }
      const channels: UserPreferences["deliveryChannels"] = enabled
        ? preferences.deliveryChannels.filter((value) => value !== "push")
        : [...preferences.deliveryChannels, "push"];
      const updated = await updatePreferences({
        ...preferenceInput(preferences),
        deliveryChannels: channels,
      });
      queryClient.setQueryData(profileQueryKey(session.user.id), {
        ...profile.data,
        preferences: updated,
      });
      await refreshEndpoints();
      setMessage(enabled ? "Daily push disabled." : "Daily push enabled.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update push.",
      );
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
        <Text style={styles.stateText}>Loading your delivery settings…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppNavigation palette={palette} />
        <Text style={styles.eyebrow}>DELIVERY CONTROL</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Your briefing, on your terms.
        </Text>
        <Text style={styles.intro}>
          Choose when Tempo arrives and where it can reach you. Your in-app
          briefing always remains the canonical version.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>TIMING</Text>
          <Text style={styles.cardTitle}>Daily schedule</Text>
          <Text style={styles.help}>
            Tempo schedules once per local day. Your timezone keeps the chosen
            time stable through daylight-saving changes.
          </Text>
          <Text style={styles.fieldLabel}>LOCAL TIME</Text>
          <TextInput
            accessibilityLabel="Daily briefing time"
            onChangeText={setDailyTime}
            style={styles.fullInput}
            value={dailyTime}
          />
          <Text style={styles.fieldLabel}>TIMEZONE</Text>
          <TextInput
            accessibilityLabel="Briefing timezone"
            autoCapitalize="none"
            onChangeText={setTimezone}
            style={styles.fullInput}
            value={timezone}
          />
          <Action
            label="Use current timezone"
            disabled={busy}
            onPress={() =>
              setTimezone(
                Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
              )
            }
            styles={styles}
            variant="secondary"
          />
          <Action
            label="Save daily schedule"
            disabled={busy}
            onPress={saveSchedule}
            styles={styles}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>IPHONE</Text>
          <Text style={styles.cardTitle}>Mobile push</Text>
          <Text style={styles.help}>
            Push is registered to this physical iPhone and opens the exact
            canonical briefing. Invalid tokens are disabled automatically after
            receipt reconciliation.
          </Text>
          <Action
            label={
              preferences.deliveryChannels.includes("push")
                ? "Disable daily push"
                : "Enable daily push"
            }
            disabled={busy}
            onPress={togglePush}
            styles={styles}
            variant={
              preferences.deliveryChannels.includes("push")
                ? "secondary"
                : "primary"
            }
          />
          <Text style={styles.statusText}>
            {endpoints.data?.filter(
              ({ channel, enabled }) => channel === "push" && enabled,
            ).length ?? 0}{" "}
            active{" "}
            {endpoints.data?.filter(
              ({ channel, enabled }) => channel === "push" && enabled,
            ).length === 1
              ? "device"
              : "devices"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>BOUNDARIES</Text>
          <Text style={styles.cardTitle}>Quiet hours</Text>
          <Text style={styles.help}>
            External messages wait until this local-time window ends.
          </Text>
          <Text style={styles.fieldLabel}>LOCAL-TIME WINDOW</Text>
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
          <Text style={styles.sectionLabel}>OTHER CHANNELS</Text>
          <Text style={styles.cardTitle}>Verified destinations</Text>
          <Text style={styles.help}>
            Email and SMS stay off until the destination is verified.
          </Text>
          <View style={styles.row}>
            {(["email", "sms"] as const).map((value) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: channel === value }}
                key={value}
                onPress={() => setChannel(value)}
                style={[styles.chip, channel === value && styles.chipSelected]}
              >
                <Text
                  style={[
                    styles.chipText,
                    channel === value && styles.chipTextSelected,
                  ]}
                >
                  {value.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel={
              channel === "email" ? "Email destination" : "SMS destination"
            }
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
                variant="secondary"
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
                    variant="secondary"
                  />
                  <TextInput
                    accessibilityLabel={`Verification code for ${endpoint.destination}`}
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
                variant="danger"
              />
            </View>
          ))}
        </View>
        {message === null ? null : (
          <View accessibilityRole="alert" style={styles.notice}>
            <Text style={styles.message}>{message}</Text>
          </View>
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
  variant = "primary",
}: {
  label: string;
  disabled: boolean;
  onPress: () => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => void onPress()}
      style={({ pressed }) => [
        styles.action,
        variant === "secondary" && styles.actionSecondary,
        variant === "danger" && styles.actionDanger,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          variant === "secondary" && styles.actionTextSecondary,
          variant === "danger" && styles.actionTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    safeArea: { backgroundColor: palette.background, flex: 1 },
    state: {
      alignItems: "center",
      backgroundColor: palette.background,
      flex: 1,
      gap: 12,
      justifyContent: "center",
    },
    stateText: { color: palette.textMuted, fontSize: 14 },
    content: {
      alignSelf: "center",
      gap: 16,
      maxWidth: 720,
      padding: 22,
      paddingBottom: 60,
      width: "100%",
    },
    eyebrow: {
      color: palette.accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      marginTop: 6,
    },
    title: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 34,
      fontWeight: "400",
      letterSpacing: -0.8,
      lineHeight: 41,
    },
    intro: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
    card: {
      borderTopColor: palette.border,
      borderTopWidth: 1,
      gap: 13,
      paddingBottom: 10,
      paddingTop: 22,
    },
    sectionLabel: {
      color: palette.accent,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.2,
    },
    cardTitle: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 22,
      fontWeight: "400",
    },
    fieldLabel: {
      color: palette.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginTop: 2,
    },
    help: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
    statusText: {
      color: palette.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    input: {
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderRadius: 2,
      borderWidth: 1,
      color: palette.text,
      fontSize: 16,
      minHeight: 48,
      padding: 12,
      width: 104,
    },
    fullInput: {
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderRadius: 2,
      borderWidth: 1,
      color: palette.text,
      fontSize: 16,
      minHeight: 48,
      padding: 12,
    },
    chip: {
      borderColor: palette.border,
      borderRadius: 2,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    chipSelected: {
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent,
    },
    chipText: { color: palette.text, fontSize: 12, fontWeight: "800" },
    chipTextSelected: { color: palette.accent },
    action: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: palette.accent,
      borderColor: palette.accent,
      borderRadius: 2,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    actionText: {
      color: palette.background,
      fontSize: 13,
      fontWeight: "800",
    },
    actionSecondary: { backgroundColor: "transparent" },
    actionTextSecondary: { color: palette.accent },
    actionDanger: {
      backgroundColor: "transparent",
      borderColor: palette.negative,
    },
    actionTextDanger: { color: palette.negative },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.62 },
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
      borderRadius: 2,
      borderWidth: 1,
      color: palette.text,
      letterSpacing: 2,
      minHeight: 44,
      padding: 9,
      width: 104,
    },
    notice: {
      backgroundColor: palette.accentSoft,
      borderLeftColor: palette.accent,
      borderLeftWidth: 3,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    message: { color: palette.accent, fontSize: 13, fontWeight: "700" },
    endpointError: {
      color: palette.text,
      fontSize: 13,
      lineHeight: 18,
    },
  });
