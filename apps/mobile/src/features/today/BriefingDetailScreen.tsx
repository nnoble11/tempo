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
import {
  describeItemEvidenceSupport,
  formatBriefingDuration,
  formatItemEvidenceSupport,
  getItemEvidenceSupport,
  uniqueItemCitations,
} from "./today-utils";

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
        <Text accessibilityRole="header" style={styles.stateTitle}>
          Opening your briefing…
        </Text>
        <Text style={styles.stateText}>
          Retrieving the canonical version and its sources.
        </Text>
      </SafeAreaView>
    );
  }
  if (query.isError) {
    return (
      <SafeAreaView style={styles.state}>
        <Text accessibilityRole="header" style={styles.stateTitle}>
          This briefing is unavailable.
        </Text>
        <Text style={styles.stateText}>
          Check your connection, then try opening it again.
        </Text>
        <View style={styles.stateActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void query.refetch()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.secondaryButton}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const briefing = query.data;
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Today</Text>
        </Pressable>
        <Text style={styles.eyebrow}>YOUR TEMPO</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {briefing.overview}
        </Text>
        <Text style={styles.meta}>
          {formatBriefingDuration(briefing.estimatedSeconds)} ·{" "}
          {briefing.items.length}{" "}
          {briefing.items.length === 1 ? "update" : "updates"} · one clear end
        </Text>
        {briefing.items.map((item) => {
          const evidenceSupport = getItemEvidenceSupport(item);
          const citations = uniqueItemCitations(item);
          return (
            <View
              accessibilityLabel={`Briefing section ${item.position} of ${briefing.items.length}`}
              key={item.id}
              style={styles.section}
            >
              <View style={styles.itemMeta}>
                <Text style={styles.number}>
                  {String(item.position).padStart(2, "0")}
                </Text>
                <Text style={styles.itemTime}>
                  {formatBriefingDuration(item.estimatedSeconds)}
                </Text>
              </View>
              <Text accessibilityRole="header" style={styles.headline}>
                {item.headline}
              </Text>
              <Text style={styles.copy}>{item.takeaway}</Text>
              <Text style={styles.label}>WHY IT MATTERS</Text>
              <Text style={styles.copy}>{item.whyItMatters}</Text>
              <Text style={styles.label}>WHAT CHANGED</Text>
              <Text style={styles.copy}>{item.whatChanged}</Text>
              <Text style={styles.label}>
                {citations.length === 1 ? "SOURCE" : "SOURCES"}
              </Text>
              <View style={styles.sourceList}>
                {citations.map((citation) => (
                  <Pressable
                    key={citation.citationId}
                    accessibilityLabel={`Open ${citation.publisher}: ${citation.sourceTitle}`}
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
              {evidenceSupport === null ? null : (
                <View style={styles.evidenceNote}>
                  <Text style={styles.evidenceTitle}>
                    {formatItemEvidenceSupport(evidenceSupport)}
                  </Text>
                  <Text style={styles.evidenceCopy}>
                    {describeItemEvidenceSupport(evidenceSupport)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
        <Text style={styles.finished}>You’re informed. That’s the end.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    safeArea: { backgroundColor: palette.background, flex: 1 },
    content: {
      alignSelf: "center",
      maxWidth: 720,
      paddingHorizontal: 24,
      paddingBottom: 60,
      width: "100%",
    },
    state: {
      alignItems: "center",
      backgroundColor: palette.background,
      flex: 1,
      gap: 16,
      justifyContent: "center",
      padding: 24,
    },
    stateTitle: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 27,
      fontWeight: "400",
      letterSpacing: -0.5,
      lineHeight: 34,
      textAlign: "center",
    },
    stateText: {
      color: palette.textMuted,
      fontSize: 14,
      lineHeight: 21,
      maxWidth: 320,
      textAlign: "center",
    },
    stateActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    backButton: {
      alignSelf: "flex-start",
      justifyContent: "center",
      minHeight: 44,
      marginTop: 8,
    },
    backText: { color: palette.accent, fontSize: 16, fontWeight: "700" },
    eyebrow: {
      color: palette.accent,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      marginTop: 30,
    },
    title: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 30,
      fontWeight: "400",
      letterSpacing: -0.6,
      lineHeight: 37,
      marginTop: 12,
    },
    meta: {
      borderBottomColor: palette.border,
      borderBottomWidth: 1,
      color: palette.textMuted,
      fontSize: 15,
      paddingBottom: 30,
      paddingTop: 18,
    },
    section: {
      borderBottomColor: palette.border,
      borderBottomWidth: 1,
      paddingBottom: 32,
      paddingTop: 30,
    },
    itemMeta: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    number: { color: palette.accent, fontSize: 13, fontWeight: "800" },
    itemTime: {
      color: palette.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    headline: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 23,
      fontWeight: "400",
      lineHeight: 29,
      marginTop: 16,
    },
    copy: {
      color: palette.text,
      fontSize: 16,
      lineHeight: 25,
      marginTop: 10,
    },
    label: {
      color: palette.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      marginTop: 24,
    },
    sourceList: {
      borderBottomColor: palette.border,
      borderBottomWidth: 1,
    },
    source: {
      alignItems: "center",
      borderTopColor: palette.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
      minHeight: 48,
      paddingTop: 12,
    },
    sourceText: { color: palette.accent, flex: 1, fontSize: 14 },
    sourceArrow: { color: palette.accent, fontSize: 18 },
    evidenceNote: {
      borderLeftColor: palette.textMuted,
      borderLeftWidth: 2,
      marginTop: 20,
      paddingLeft: 12,
    },
    evidenceTitle: {
      color: palette.text,
      fontSize: 12,
      fontWeight: "700",
    },
    evidenceCopy: {
      color: palette.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
    },
    finished: {
      color: palette.textMuted,
      fontSize: 16,
      paddingVertical: 24,
      textAlign: "center",
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: palette.accent,
      borderRadius: 3,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: 18,
    },
    primaryButtonText: {
      color: palette.background,
      fontSize: 14,
      fontWeight: "800",
    },
    secondaryButton: {
      alignItems: "center",
      borderColor: palette.border,
      borderRadius: 3,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: 18,
    },
  });
