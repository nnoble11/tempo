import type {
  CanonicalBriefing,
  CanonicalBriefingItem,
} from "@tempo/contracts";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../auth/AuthProvider";
import { AppNavigation } from "../../components/AppNavigation";
import { fetchCalendarAvailability } from "../calendar/api";
import {
  useBriefingItemStates,
  useUpdateBriefingItemState,
} from "../library/hooks";
import { darkPalette, lightPalette, type TempoPalette } from "../../theme";
import { useRecordBriefingInteraction, useTodayBriefing } from "./hooks";
import {
  formatBriefingDuration,
  formatItemConfidence,
  getItemConfidence,
  getTodayViewState,
  uniqueItemCitations,
} from "./today-utils";

type BriefingInteractionEvent =
  | "opened"
  | "expanded"
  | "saved"
  | "source_clicked"
  | "useful"
  | "not_useful"
  | "dismissed"
  | "deferred";

type ItemCardProps = {
  briefing: CanonicalBriefing;
  item: CanonicalBriefingItem;
  expanded: boolean;
  feedback: "useful" | "not_useful" | null;
  saved: boolean;
  deferred: boolean;
  palette: TempoPalette;
  onToggle: () => void;
  onFeedback: (event: "useful" | "not_useful") => void;
  onSave: () => void;
  onDefer: () => void;
  onOpenCitation: (citationId: string, url: string) => void;
};

const interactionKey = (
  event: BriefingInteractionEvent,
  subjectId: string,
): string => `mobile:${event}:${subjectId}`;

const dateLabel = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));

function ItemCard({
  briefing,
  item,
  expanded,
  feedback,
  saved,
  deferred,
  palette,
  onToggle,
  onFeedback,
  onSave,
  onDefer,
  onOpenCitation,
}: ItemCardProps) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const citations = uniqueItemCitations(item);
  const confidence = getItemConfidence(item);

  return (
    <View
      style={styles.itemCard}
      accessibilityLabel={`Briefing item ${item.position} of ${briefing.items.length}`}
    >
      <View style={styles.itemMeta}>
        <Text style={styles.itemNumber}>
          {String(item.position).padStart(2, "0")}
        </Text>
        <Text style={styles.itemTime}>
          {formatBriefingDuration(item.estimatedSeconds)}
        </Text>
      </View>

      <Text accessibilityRole="header" style={styles.headline}>
        {item.headline}
      </Text>
      <Text style={styles.takeaway}>{item.takeaway}</Text>

      <Pressable
        accessibilityLabel={`${expanded ? "Hide" : "Show"} context for ${item.headline}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.expandButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.expandButtonText}>
          {expanded ? "Show less" : "Why this matters"}
        </Text>
        <Text style={styles.expandSymbol}>{expanded ? "−" : "+"}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.detailArea}>
          <Text style={styles.detailLabel}>WHY IT MATTERS TO YOU</Text>
          <Text style={styles.detailText}>{item.whyItMatters}</Text>

          <Text style={styles.detailLabel}>WHAT CHANGED</Text>
          <Text style={styles.detailText}>{item.whatChanged}</Text>

          {confidence === null ? null : (
            <>
              <Text style={styles.detailLabel}>CONFIDENCE</Text>
              <Text
                accessibilityLabel={`Confidence ${formatItemConfidence(confidence)}`}
                style={styles.detailText}
              >
                {formatItemConfidence(confidence)}
              </Text>
            </>
          )}

          <Text style={styles.detailLabel}>
            {citations.length === 1 ? "SOURCE" : "SOURCES"}
          </Text>
          <View style={styles.citationList}>
            {citations.map((citation) => (
              <Pressable
                key={citation.citationId}
                accessibilityRole="link"
                onPress={() =>
                  onOpenCitation(citation.citationId, citation.canonicalUrl)
                }
                style={({ pressed }) => [
                  styles.citation,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.citationCopy}>
                  <Text style={styles.citationPublisher}>
                    {citation.publisher}
                  </Text>
                  <Text numberOfLines={1} style={styles.citationTitle}>
                    {citation.sourceTitle}
                  </Text>
                </View>
                <Text style={styles.citationArrow}>↗</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: feedback === "useful" }}
          onPress={() => onFeedback("useful")}
          style={({ pressed }) => [
            styles.actionButton,
            feedback === "useful" && styles.actionButtonSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.actionText,
              feedback === "useful" && styles.actionTextSelected,
            ]}
          >
            Useful
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: feedback === "not_useful" }}
          onPress={() => onFeedback("not_useful")}
          style={({ pressed }) => [
            styles.actionButton,
            feedback === "not_useful" && styles.actionButtonSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.actionText,
              feedback === "not_useful" && styles.actionTextSelected,
            ]}
          >
            Less like this
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={saved ? "Unsave this update" : "Save this update"}
          accessibilityState={{ selected: saved }}
          accessibilityRole="button"
          onPress={onSave}
          style={({ pressed }) => [
            styles.actionButton,
            saved && styles.actionButtonSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, saved && styles.actionTextSelected]}>
            {saved ? "Saved ✓" : "Save"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={
            deferred
              ? "Remove this update from Later"
              : "Read this update later"
          }
          accessibilityState={{ selected: deferred }}
          accessibilityRole="button"
          onPress={onDefer}
          style={({ pressed }) => [
            styles.actionButton,
            deferred && styles.actionButtonSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.actionText, deferred && styles.actionTextSelected]}
          >
            {deferred ? "Later ✓" : "Later"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function TodayScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = colorScheme === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const query = useTodayBriefing();
  const interaction = useRecordBriefingInteraction();
  const openedBriefingId = useRef<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<
    Record<string, "useful" | "not_useful">
  >({});
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const briefing = query.data?.briefing;
  const itemStates = useBriefingItemStates(briefing?.id);
  const updateItemState = useUpdateBriefingItemState();
  const calendar = useQuery({
    queryKey: ["calendar", "availability"],
    queryFn: fetchCalendarAvailability,
    staleTime: 5 * 60_000,
  });
  const viewState = getTodayViewState({
    isPending: query.isPending,
    isError: query.isError,
    briefing,
  });

  useEffect(() => {
    if (
      briefing === null ||
      briefing === undefined ||
      openedBriefingId.current === briefing.id
    ) {
      return;
    }
    openedBriefingId.current = briefing.id;
    const firstItem = briefing.items[0];
    if (firstItem !== undefined) {
      interaction.mutate({
        briefingId: briefing.id,
        briefingItemId: firstItem.id,
        interaction: {
          eventType: "opened",
          value: {
            itemCount: briefing.items.length,
          },
          idempotencyKey: interactionKey("opened", briefing.id),
        },
      });
    }
  }, [briefing?.id]);

  const recordItemInteraction = (
    item: CanonicalBriefingItem,
    eventType: BriefingInteractionEvent,
    subjectId = item.id,
  ): void => {
    if (briefing === null || briefing === undefined) {
      return;
    }
    interaction.mutate({
      briefingId: briefing.id,
      briefingItemId: item.id,
      interaction: {
        eventType,
        value: {},
        idempotencyKey: interactionKey(eventType, subjectId),
      },
    });
  };

  const toggleExpanded = (item: CanonicalBriefingItem): void => {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
        recordItemInteraction(item, "expanded");
      }
      return next;
    });
  };

  const recordFeedback = (
    item: CanonicalBriefingItem,
    eventType: "useful" | "not_useful",
  ): void => {
    if (briefing === null || briefing === undefined) {
      return;
    }
    const previous = feedback[item.id] ?? null;
    setInteractionError(null);
    setFeedback((current) => ({ ...current, [item.id]: eventType }));
    interaction.mutate(
      {
        briefingId: briefing.id,
        briefingItemId: item.id,
        interaction: {
          eventType,
          value: {},
          idempotencyKey: interactionKey(eventType, item.id),
        },
      },
      {
        onError: () => {
          setFeedback((current) => {
            if (previous === null) {
              return Object.fromEntries(
                Object.entries(current).filter(([id]) => id !== item.id),
              );
            }
            return { ...current, [item.id]: previous };
          });
          setInteractionError(
            "Your feedback didn’t save. Check your connection and try again.",
          );
        },
      },
    );
  };

  const saveItem = (item: CanonicalBriefingItem, saved: boolean): void => {
    setInteractionError(null);
    updateItemState.mutate(
      {
        briefingItemId: item.id,
        input: { saved: !saved },
      },
      {
        onSuccess: () => {
          if (!saved) {
            recordItemInteraction(item, "saved");
          }
        },
        onError: () => {
          setInteractionError(
            "This update wasn’t saved. Check your connection and try again.",
          );
        },
      },
    );
  };

  const deferItem = (item: CanonicalBriefingItem, deferred: boolean): void => {
    setInteractionError(null);
    updateItemState.mutate(
      {
        briefingItemId: item.id,
        input: { deferred: !deferred },
      },
      {
        onSuccess: () => {
          if (!deferred) {
            recordItemInteraction(item, "deferred");
          }
        },
        onError: () =>
          setInteractionError(
            "This update wasn’t moved. Check your connection and try again.",
          ),
      },
    );
  };

  const openCitation = (
    item: CanonicalBriefingItem,
    citationId: string,
    url: string,
  ): void => {
    recordItemInteraction(item, "source_clicked", citationId);
    void Linking.openURL(url);
  };

  if (viewState === "loading") {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <ActivityIndicator color={palette.accent} size="small" />
        <Text style={styles.stateTitle}>Preparing your briefing</Text>
        <Text style={styles.stateCopy}>
          Gathering the few updates that matter today.
        </Text>
      </SafeAreaView>
    );
  }

  if (viewState === "error") {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Text style={styles.eyebrow}>TEMPO</Text>
        <Text style={styles.stateTitle}>Your briefing is out of reach</Text>
        <Text style={styles.stateCopy}>
          {query.error instanceof Error
            ? query.error.message
            : "Check your connection and try again."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void query.refetch()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (viewState === "empty" || briefing === null || briefing === undefined) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Text style={styles.eyebrow}>TEMPO</Text>
        <Text style={styles.stateTitle}>You’re all caught up</Text>
        <Text style={styles.stateCopy}>
          There are no meaningful updates waiting. We’ll let you know when that
          changes.
        </Text>
        <View style={styles.doneRule} />
        <Text style={styles.doneCopy}>Close the app. Keep your attention.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isPending}
            tintColor={palette.accent}
            onRefresh={() => void query.refetch()}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <AppNavigation palette={palette} />
        <View style={styles.header}>
          <View>
            <Text style={styles.wordmark}>tempo</Text>
            <Text style={styles.date}>{dateLabel(briefing.scheduledFor)}</Text>
          </View>
          <View style={styles.durationPill}>
            <Text style={styles.durationValue}>
              {formatBriefingDuration(briefing.estimatedSeconds)}
            </Text>
            <Text style={styles.durationLabel}>BRIEFING</Text>
          </View>
        </View>

        {calendar.data?.suggestion === null ||
        calendar.data?.suggestion === undefined ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/calendar")}
            style={styles.calendarSuggestion}
          >
            <Text style={styles.eyebrow}>A GOOD MOMENT</Text>
            <Text style={styles.calendarSuggestionTitle}>
              You have {calendar.data.suggestion.availableMinutes} minutes.
            </Text>
            <Text style={styles.stateCopy}>
              A {calendar.data.suggestion.suggestedBriefingMinutes}-minute
              briefing fits before your next busy window.
            </Text>
          </Pressable>
        )}

        <View style={styles.overviewCard}>
          <Text style={styles.eyebrow}>WHY TODAY MATTERS</Text>
          <Text accessibilityRole="header" style={styles.overview}>
            {briefing.overview}
          </Text>
          <Text style={styles.briefingCount}>
            {briefing.items.length}{" "}
            {briefing.items.length === 1 ? "update" : "updates"} · a clear end
          </Text>
        </View>

        {interactionError === null ? null : (
          <View accessibilityRole="alert" style={styles.noticeBanner}>
            <Text style={styles.noticeText}>{interactionError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setInteractionError(null)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.noticeDismiss}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.itemList}>
          {briefing.items.map((item) => {
            const state = itemStates.data?.find(
              ({ briefingItemId }) => briefingItemId === item.id,
            );
            const saved =
              state?.savedAt !== null && state?.savedAt !== undefined;
            const deferred =
              state?.deferredAt !== null && state?.deferredAt !== undefined;
            return (
              <ItemCard
                key={item.id}
                briefing={briefing}
                item={item}
                expanded={expandedItems.has(item.id)}
                feedback={feedback[item.id] ?? null}
                saved={saved}
                deferred={deferred}
                palette={palette}
                onToggle={() => toggleExpanded(item)}
                onFeedback={(eventType) => recordFeedback(item, eventType)}
                onSave={() => saveItem(item, saved)}
                onDefer={() => deferItem(item, deferred)}
                onOpenCitation={(citationId, url) =>
                  openCitation(item, citationId, url)
                }
              />
            );
          })}
        </View>

        <View style={styles.finished}>
          <View style={styles.finishedMark} />
          <Text style={styles.finishedTitle}>You’re informed.</Text>
          <Text style={styles.finishedCopy}>
            That’s the end of today’s briefing.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollContent: {
      alignSelf: "center",
      maxWidth: 720,
      paddingHorizontal: 20,
      paddingBottom: 52,
      width: "100%",
    },
    header: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 20,
      paddingTop: 20,
    },
    wordmark: {
      color: palette.text,
      fontSize: 32,
      fontWeight: "700",
      letterSpacing: -1.5,
      lineHeight: 36,
    },
    date: {
      color: palette.textMuted,
      fontSize: 13,
      marginTop: 3,
    },
    durationPill: {
      alignItems: "center",
      backgroundColor: palette.accentSoft,
      borderRadius: 18,
      minWidth: 70,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    durationValue: {
      color: palette.accent,
      fontSize: 16,
      fontWeight: "700",
    },
    durationLabel: {
      color: palette.accent,
      fontSize: 8,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginTop: 1,
    },
    overviewCard: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 20,
      borderWidth: 1,
      padding: 22,
    },
    calendarSuggestion: {
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent,
      borderRadius: 16,
      borderWidth: 1,
      gap: 8,
      marginTop: 16,
      padding: 16,
    },
    calendarSuggestionTitle: {
      color: palette.text,
      fontSize: 20,
      fontWeight: "800",
    },
    eyebrow: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.6,
    },
    overview: {
      color: palette.text,
      fontSize: 23,
      fontWeight: "600",
      letterSpacing: -0.5,
      lineHeight: 30,
      marginTop: 12,
    },
    briefingCount: {
      color: palette.textMuted,
      fontSize: 12,
      marginTop: 16,
    },
    itemList: {
      gap: 16,
      marginTop: 18,
    },
    noticeBanner: {
      alignItems: "center",
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      marginTop: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    noticeText: {
      color: palette.text,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    noticeDismiss: {
      color: palette.accent,
      fontSize: 12,
      fontWeight: "800",
    },
    itemCard: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 20,
      borderWidth: 1,
      padding: 20,
    },
    itemMeta: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    itemNumber: {
      color: palette.accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
    },
    itemTime: {
      color: palette.textMuted,
      fontSize: 11,
      fontWeight: "600",
    },
    headline: {
      color: palette.text,
      fontSize: 21,
      fontWeight: "700",
      letterSpacing: -0.35,
      lineHeight: 27,
    },
    takeaway: {
      color: palette.textMuted,
      fontSize: 15,
      lineHeight: 23,
      marginTop: 10,
    },
    expandButton: {
      alignItems: "center",
      borderBottomColor: palette.border,
      borderTopColor: palette.border,
      borderBottomWidth: 1,
      borderTopWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 18,
      paddingVertical: 14,
    },
    expandButtonText: {
      color: palette.accent,
      fontSize: 13,
      fontWeight: "700",
    },
    expandSymbol: {
      color: palette.accent,
      fontSize: 19,
      fontWeight: "400",
    },
    detailArea: {
      paddingTop: 18,
    },
    detailLabel: {
      color: palette.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.25,
      marginBottom: 7,
      marginTop: 16,
    },
    detailText: {
      color: palette.text,
      fontSize: 14,
      lineHeight: 21,
    },
    citationList: {
      gap: 8,
    },
    citation: {
      alignItems: "center",
      backgroundColor: palette.surfaceMuted,
      borderRadius: 12,
      flexDirection: "row",
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    citationCopy: {
      flex: 1,
    },
    citationPublisher: {
      color: palette.text,
      fontSize: 12,
      fontWeight: "700",
    },
    citationTitle: {
      color: palette.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    citationArrow: {
      color: palette.accent,
      fontSize: 15,
      marginLeft: 10,
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 18,
    },
    actionButton: {
      alignItems: "center",
      borderColor: palette.border,
      borderRadius: 12,
      borderWidth: 1,
      flexBasis: "46%",
      flexGrow: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    actionButtonSelected: {
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent,
    },
    actionText: {
      color: palette.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    actionTextSelected: {
      color: palette.accent,
    },
    pressed: {
      opacity: 0.62,
    },
    finished: {
      alignItems: "center",
      paddingBottom: 20,
      paddingTop: 42,
    },
    finishedMark: {
      backgroundColor: palette.accent,
      borderRadius: 4,
      height: 8,
      marginBottom: 16,
      width: 8,
    },
    finishedTitle: {
      color: palette.text,
      fontSize: 20,
      fontWeight: "700",
    },
    finishedCopy: {
      color: palette.textMuted,
      fontSize: 13,
      marginTop: 5,
    },
    signOutButton: {
      marginTop: 24,
      padding: 10,
    },
    signOutText: {
      color: palette.textMuted,
      fontSize: 12,
    },
    stateScreen: {
      alignItems: "center",
      backgroundColor: palette.background,
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 34,
    },
    stateTitle: {
      color: palette.text,
      fontSize: 27,
      fontWeight: "700",
      letterSpacing: -0.6,
      marginTop: 16,
      textAlign: "center",
    },
    stateCopy: {
      color: palette.textMuted,
      fontSize: 15,
      lineHeight: 23,
      marginTop: 10,
      maxWidth: 330,
      textAlign: "center",
    },
    primaryButton: {
      backgroundColor: palette.accent,
      borderRadius: 14,
      minHeight: 48,
      marginTop: 24,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    primaryButtonText: {
      color: palette.background,
      fontSize: 14,
      fontWeight: "800",
    },
    doneRule: {
      backgroundColor: palette.border,
      height: 1,
      marginVertical: 24,
      width: 80,
    },
    doneCopy: {
      color: palette.textMuted,
      fontSize: 12,
    },
  });
