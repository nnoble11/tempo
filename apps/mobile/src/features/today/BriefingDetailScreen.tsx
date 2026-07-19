import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { darkPalette, lightPalette, type TempoPalette } from "../../theme";
import { useBriefing } from "./hooks";
import { formatBriefingDuration, uniqueItemCitations } from "./today-utils";

export function BriefingDetailScreen() {
  const { briefingId } = useLocalSearchParams<{ briefingId: string }>();
  const router = useRouter();
  const palette = useColorScheme() === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const query = useBriefing(briefingId);

  if (query.isPending) {
    return (
      <SafeAreaView style={styles.state}>
        <ActivityIndicator color={palette.accent} />
        <Text style={styles.stateText}>Opening your briefing…</Text>
      </SafeAreaView>
    );
  }
  if (query.isError) {
    return (
      <SafeAreaView style={styles.state}>
        <Text style={styles.title}>This briefing is unavailable.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back to Today</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const briefing = query.data;
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Today</Text>
        </Pressable>
        <Text style={styles.eyebrow}>YOUR TEMPO</Text>
        <Text style={styles.title}>{briefing.overview}</Text>
        <Text style={styles.meta}>
          {formatBriefingDuration(briefing.estimatedSeconds)} ·{" "}
          {briefing.items.length} updates
        </Text>
        {briefing.items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.number}>
              {String(item.position).padStart(2, "0")}
            </Text>
            <Text style={styles.headline}>{item.headline}</Text>
            <Text style={styles.copy}>{item.takeaway}</Text>
            <Text style={styles.label}>WHY IT MATTERS</Text>
            <Text style={styles.copy}>{item.whyItMatters}</Text>
            <Text style={styles.label}>WHAT CHANGED</Text>
            <Text style={styles.copy}>{item.whatChanged}</Text>
            {uniqueItemCitations(item).map((citation) => (
              <Pressable
                key={citation.citationId}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(citation.canonicalUrl)}
                style={styles.source}
              >
                <Text style={styles.sourceText}>
                  {citation.publisher} · {citation.sourceTitle}
                </Text>
                <Text style={styles.sourceArrow}>↗</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <Text style={styles.finished}>You’re informed. That’s the end.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    safeArea: { backgroundColor: palette.background, flex: 1 },
    content: { gap: 20, padding: 24, paddingBottom: 60 },
    state: {
      alignItems: "center",
      backgroundColor: palette.background,
      flex: 1,
      gap: 16,
      justifyContent: "center",
      padding: 24,
    },
    stateText: { color: palette.textMuted },
    backButton: { alignSelf: "flex-start", paddingVertical: 8 },
    backText: { color: palette.accent, fontSize: 16, fontWeight: "700" },
    eyebrow: {
      color: palette.accent,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    title: {
      color: palette.text,
      fontSize: 30,
      fontWeight: "800",
      lineHeight: 37,
    },
    meta: { color: palette.textMuted, fontSize: 15 },
    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 12,
      padding: 20,
    },
    number: { color: palette.accent, fontSize: 13, fontWeight: "800" },
    headline: {
      color: palette.text,
      fontSize: 23,
      fontWeight: "800",
      lineHeight: 29,
    },
    copy: { color: palette.text, fontSize: 16, lineHeight: 24 },
    label: {
      color: palette.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      marginTop: 8,
    },
    source: {
      alignItems: "center",
      borderTopColor: palette.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
      paddingTop: 12,
    },
    sourceText: { color: palette.accent, flex: 1, fontSize: 14 },
    sourceArrow: { color: palette.accent, fontSize: 18 },
    finished: {
      color: palette.textMuted,
      fontSize: 16,
      paddingVertical: 24,
      textAlign: "center",
    },
  });
