import { useRouter } from "expo-router";
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
import { useLibraryItems, useUpdateBriefingItemState } from "./hooks";

export function LibraryScreen({ kind }: { kind: "saved" | "later" }) {
  const palette = useColorScheme() === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();
  const query = useLibraryItems(kind);
  const update = useUpdateBriefingItemState();
  const [message, setMessage] = useState<string | null>(null);
  const title = kind === "saved" ? "Saved" : "Later";
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) {
    return (
      <SafeAreaView style={styles.state}>
        <ActivityIndicator color={palette.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppNavigation palette={palette} />
        <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
        <Text style={styles.title}>
          {kind === "saved"
            ? "Keep the updates worth returning to."
            : "Set something aside without losing it."}
        </Text>
        {query.isError ? (
          <StateCard
            copy="This collection could not be loaded."
            action="Retry"
            onPress={() => void query.refetch()}
            styles={styles}
          />
        ) : null}
        {items.length === 0 ? (
          <StateCard
            copy={
              kind === "saved"
                ? "Nothing saved yet."
                : "Nothing waiting for later."
            }
            action="Return to Today"
            onPress={() => router.push("/")}
            styles={styles}
          />
        ) : null}
        {items.map(({ state, briefing, item }) => (
          <View key={state.id} style={styles.card}>
            <Text style={styles.meta}>
              {new Date(briefing.scheduledFor).toLocaleDateString()} ·{" "}
              {Math.ceil(item.estimatedSeconds / 60)} min
            </Text>
            <Text style={styles.cardTitle}>{item.headline}</Text>
            <Text style={styles.copy}>{item.takeaway}</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/briefings/[briefingId]",
                    params: { briefingId: briefing.id },
                  })
                }
                style={styles.action}
              >
                <Text style={styles.actionText}>Open briefing</Text>
              </Pressable>
              <Pressable
                disabled={update.isPending}
                onPress={() =>
                  void update
                    .mutateAsync({
                      briefingItemId: item.id,
                      input:
                        kind === "saved"
                          ? { saved: false }
                          : { deferred: false },
                    })
                    .then(() => setMessage(`Removed from ${title}.`))
                    .catch(() => setMessage("Could not update this item."))
                }
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {query.hasNextPage ? (
          <Pressable
            disabled={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </Text>
          </Pressable>
        ) : null}
        {message === null ? null : (
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StateCard({
  copy,
  action,
  onPress,
  styles,
}: {
  copy: string;
  action: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.copy}>{copy}</Text>
      <Pressable onPress={onPress} style={styles.action}>
        <Text style={styles.actionText}>{action}</Text>
      </Pressable>
    </View>
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
    meta: { color: palette.accent, fontSize: 11, fontWeight: "800" },
    cardTitle: {
      color: palette.text,
      fontSize: 21,
      fontWeight: "800",
      lineHeight: 27,
    },
    copy: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    action: {
      backgroundColor: palette.accent,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    actionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    secondary: {
      borderColor: palette.border,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    secondaryText: { color: palette.text, fontSize: 12, fontWeight: "800" },
    message: { color: palette.accent, fontSize: 14, fontWeight: "700" },
  });
