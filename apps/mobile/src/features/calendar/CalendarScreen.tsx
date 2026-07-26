import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppNavigation } from "../../components/AppNavigation";
import { darkPalette, lightPalette, type TempoPalette } from "../../theme";
import {
  connectDeviceCalendar,
  disconnectCalendar,
  fetchCalendarAvailability,
  syncCalendarAvailability,
} from "./api";
import { readDeviceCalendarAvailability } from "./device-calendar";

const availabilityKey = ["calendar", "availability"] as const;

export function CalendarScreen() {
  const palette = useColorScheme() === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: availabilityKey,
    queryFn: fetchCalendarAvailability,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const connectAndSync = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      const local = await readDeviceCalendarAvailability();
      if (local.status === "denied") {
        setMessage(
          "Calendar permission was not granted. Tempo works normally without it.",
        );
        return;
      }
      const connection = await connectDeviceCalendar();
      await syncCalendarAvailability(connection.id, local.availability);
      await client.invalidateQueries({ queryKey: availabilityKey });
      setMessage(
        "Free/busy times synced. Event names and details stayed on this device.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sync.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    const connection = query.data?.connection;
    if (connection === null || connection === undefined) return;
    setBusy(true);
    try {
      await disconnectCalendar(connection.id);
      await client.invalidateQueries({ queryKey: availabilityKey });
      setMessage("Calendar suggestions disabled and busy times deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not disconnect.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (query.isPending) {
    return (
      <SafeAreaView style={styles.state}>
        <ActivityIndicator color={palette.accent} />
      </SafeAreaView>
    );
  }

  const suggestion = query.data?.suggestion;
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppNavigation palette={palette} />
        <Text style={styles.eyebrow}>CALENDAR AVAILABILITY</Text>
        <Text style={styles.title}>Make open time useful, not invasive.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy boundary</Text>
          <Text style={styles.copy}>
            Tempo requests read access and sends only busy start and end times
            for the next 48 hours. Titles, notes, locations, attendees, calendar
            names, and event identifiers are never uploaded. Tempo never edits
            your calendar.
          </Text>
          <Pressable
            disabled={busy}
            onPress={() => void connectAndSync()}
            style={styles.action}
          >
            <Text style={styles.actionText}>
              {busy
                ? "Working…"
                : query.data?.connection === null
                  ? "Connect this iPhone"
                  : "Refresh free/busy times"}
            </Text>
          </Pressable>
          {query.data?.connection === null ? null : (
            <Pressable
              disabled={busy}
              onPress={() => void disconnect()}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Disconnect and delete</Text>
            </Pressable>
          )}
        </View>
        {suggestion === null || suggestion === undefined ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No suggestion right now</Text>
            <Text style={styles.copy}>
              Tempo only offers a briefing when a synchronized free window fits
              at least two minutes.
            </Text>
          </View>
        ) : (
          <View style={styles.suggestion}>
            <Text style={styles.eyebrow}>A GOOD MOMENT</Text>
            <Text style={styles.cardTitle}>
              You have {suggestion.availableMinutes} minutes.
            </Text>
            <Text style={styles.copy}>
              A {suggestion.suggestedBriefingMinutes}-minute briefing fits
              before your next busy window.
            </Text>
          </View>
        )}
        {message === null ? null : (
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    safeArea: { backgroundColor: palette.background, flex: 1 },
    state: {
      alignItems: "center",
      backgroundColor: palette.background,
      flex: 1,
      justifyContent: "center",
    },
    content: { gap: 16, padding: 22, paddingBottom: 60 },
    eyebrow: {
      color: palette.accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
    },
    title: {
      color: palette.text,
      fontSize: 31,
      fontWeight: "800",
      lineHeight: 38,
    },
    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 12,
      padding: 18,
    },
    suggestion: {
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent,
      borderRadius: 18,
      borderWidth: 1,
      gap: 12,
      padding: 18,
    },
    cardTitle: {
      color: palette.text,
      fontSize: 21,
      fontWeight: "800",
      lineHeight: 27,
    },
    copy: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
    action: {
      alignSelf: "flex-start",
      backgroundColor: palette.accent,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    actionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    secondary: {
      alignSelf: "flex-start",
      borderColor: palette.border,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    secondaryText: { color: palette.text, fontSize: 12, fontWeight: "800" },
    message: { color: palette.accent, fontSize: 14, fontWeight: "700" },
  });
