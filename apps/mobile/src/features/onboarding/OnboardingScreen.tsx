import type { DeliveryPreferenceChannel, DesiredDepth } from "@tempo/contracts";
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
import { useCompleteOnboarding } from "../account/hooks";
import { buildOnboardingInput, SUGGESTED_INTERESTS } from "./onboarding-model";

const durationOptions = [2, 5, 10, 15] as const;
const timeOptions = ["07:00", "08:00", "12:00", "18:00"] as const;
const depthOptions: readonly DesiredDepth[] = ["brief", "standard", "deep"];

const deviceTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const deviceLocale = (): string =>
  Intl.DateTimeFormat().resolvedOptions().locale || "en-US";

export function OnboardingScreen() {
  const palette = useColorScheme() === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { signOut } = useAuth();
  const completion = useCompleteOnboarding();
  const [duration, setDuration] = useState<number>(5);
  const [dailyTime, setDailyTime] = useState("08:00");
  const [depth, setDepth] = useState<DesiredDepth>("standard");
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [customInterest, setCustomInterest] = useState("");
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleSuggestion = (name: string): void => {
    setSelectedSuggestions((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const addCustomInterest = (): void => {
    const normalized = customInterest.trim();
    if (
      normalized.length === 0 ||
      customInterests.some(
        (interest) =>
          interest.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
      )
    ) {
      return;
    }
    setCustomInterests((current) => [...current, normalized]);
    setCustomInterest("");
  };

  const submit = (): void => {
    if (selectedSuggestions.size + customInterests.length === 0) {
      setValidationError("Choose or add at least one interest.");
      return;
    }
    const deliveryChannels: DeliveryPreferenceChannel[] = ["in_app"];
    if (pushEnabled) {
      deliveryChannels.push("push");
    }
    if (emailEnabled) {
      deliveryChannels.push("email");
    }

    setValidationError(null);
    completion.mutate(
      buildOnboardingInput({
        timezone: deviceTimezone(),
        locale: deviceLocale(),
        defaultBriefingMinutes: duration,
        dailyBriefingTime: dailyTime,
        desiredDepth: depth,
        deliveryChannels,
        selectedSuggestions: [...selectedSuggestions],
        customInterests,
      }),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SET UP YOUR TEMPO</Text>
            <Text style={styles.title}>A briefing shaped around you.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void signOut()}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionNumber}>01</Text>
          <Text style={styles.sectionTitle}>How much time do you have?</Text>
          <View style={styles.optionRow}>
            {durationOptions.map((option) => (
              <Option
                key={option}
                label={`${option} min`}
                selected={duration === option}
                styles={styles}
                onPress={() => setDuration(option)}
              />
            ))}
          </View>

          <Text style={styles.subLabel}>DAILY BRIEFING TIME</Text>
          <View style={styles.optionRow}>
            {timeOptions.map((option) => (
              <Option
                key={option}
                label={option}
                selected={dailyTime === option}
                styles={styles}
                onPress={() => setDailyTime(option)}
              />
            ))}
          </View>
          <Text style={styles.helper}>{deviceTimezone()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionNumber}>02</Text>
          <Text style={styles.sectionTitle}>What deserves your attention?</Text>
          <View style={styles.chipWrap}>
            {SUGGESTED_INTERESTS.map((suggestion) => (
              <Option
                key={suggestion.name}
                label={suggestion.name}
                selected={selectedSuggestions.has(suggestion.name)}
                styles={styles}
                onPress={() => toggleSuggestion(suggestion.name)}
              />
            ))}
          </View>

          <View style={styles.customRow}>
            <TextInput
              onChangeText={setCustomInterest}
              onSubmitEditing={addCustomInterest}
              placeholder="Add anything else you care about"
              placeholderTextColor={palette.textMuted}
              style={styles.customInput}
              value={customInterest}
            />
            <Pressable
              accessibilityLabel="Add custom interest"
              accessibilityRole="button"
              onPress={addCustomInterest}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+</Text>
            </Pressable>
          </View>

          {customInterests.map((interest) => (
            <Pressable
              key={interest}
              accessibilityHint="Removes this interest"
              accessibilityRole="button"
              onPress={() =>
                setCustomInterests((current) =>
                  current.filter((value) => value !== interest),
                )
              }
            >
              <Text style={styles.customItem}>{interest} ×</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionNumber}>03</Text>
          <Text style={styles.sectionTitle}>
            How should Tempo explain things?
          </Text>
          <View style={styles.optionRow}>
            {depthOptions.map((option) => (
              <Option
                key={option}
                label={`${option.charAt(0).toLocaleUpperCase()}${option.slice(1)}`}
                selected={depth === option}
                styles={styles}
                onPress={() => setDepth(option)}
              />
            ))}
          </View>

          <Text style={styles.subLabel}>DELIVERY</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: pushEnabled }}
            onPress={() => setPushEnabled((current) => !current)}
            style={styles.toggleRow}
          >
            <Text style={styles.toggleText}>Mobile notification</Text>
            <Text style={styles.check}>{pushEnabled ? "✓" : "○"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: emailEnabled }}
            onPress={() => setEmailEnabled((current) => !current)}
            style={styles.toggleRow}
          >
            <Text style={styles.toggleText}>Email copy</Text>
            <Text style={styles.check}>{emailEnabled ? "✓" : "○"}</Text>
          </Pressable>
          <Text style={styles.helper}>
            The in-app briefing is always canonical. You can change channels
            later.
          </Text>
        </View>

        {validationError === null && completion.error === null ? null : (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError ??
              (completion.error instanceof Error
                ? completion.error.message
                : "Tempo could not save your setup.")}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={completion.isPending}
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || completion.isPending) && styles.pressed,
          ]}
        >
          {completion.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              Build my daily briefing
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

type OnboardingStyles = ReturnType<typeof createStyles>;

function Option({
  label,
  selected,
  styles,
  onPress,
}: {
  label: string;
  selected: boolean;
  styles: OnboardingStyles;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: palette.background,
      flex: 1,
    },
    content: {
      padding: 22,
      paddingBottom: 48,
    },
    header: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 24,
      marginTop: 10,
    },
    eyebrow: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    title: {
      color: palette.text,
      fontSize: 31,
      fontWeight: "700",
      letterSpacing: -1,
      lineHeight: 37,
      marginTop: 10,
      maxWidth: 290,
    },
    signOut: {
      color: palette.textMuted,
      fontSize: 12,
      padding: 5,
    },
    section: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 16,
      padding: 20,
    },
    sectionNumber: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.4,
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 21,
      fontWeight: "700",
      lineHeight: 27,
      marginBottom: 16,
      marginTop: 8,
    },
    optionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    option: {
      backgroundColor: palette.surfaceMuted,
      borderColor: palette.border,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    optionSelected: {
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent,
    },
    optionText: {
      color: palette.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    optionTextSelected: {
      color: palette.accent,
    },
    subLabel: {
      color: palette.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.3,
      marginBottom: 10,
      marginTop: 20,
    },
    helper: {
      color: palette.textMuted,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 10,
    },
    customRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    customInput: {
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderRadius: 12,
      borderWidth: 1,
      color: palette.text,
      flex: 1,
      fontSize: 14,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    addButton: {
      alignItems: "center",
      backgroundColor: palette.accent,
      borderRadius: 12,
      justifyContent: "center",
      width: 46,
    },
    addButtonText: {
      color: "#FFFFFF",
      fontSize: 22,
    },
    customItem: {
      color: palette.accent,
      fontSize: 13,
      marginTop: 10,
    },
    toggleRow: {
      alignItems: "center",
      borderBottomColor: palette.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 13,
    },
    toggleText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: "600",
    },
    check: {
      color: palette.accent,
      fontSize: 18,
    },
    error: {
      color: palette.negative,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 14,
      textAlign: "center",
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: palette.accent,
      borderRadius: 16,
      justifyContent: "center",
      minHeight: 54,
      paddingHorizontal: 18,
      paddingVertical: 15,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
    pressed: {
      opacity: 0.7,
    },
  });
