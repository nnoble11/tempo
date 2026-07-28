import { useRouter } from "expo-router";
import { useMemo } from "react";
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
import { useBriefingHistory } from "./hooks";

export function HistoryScreen() {
  const palette = useColorScheme() === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();
  const query = useBriefingHistory();
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
        <Text style={styles.eyebrow}>BRIEFING HISTORY</Text>
        <Text style={styles.title}>A finite record of what mattered.</Text>
        {query.isError ? (
          <Pressable onPress={() => void query.refetch()} style={styles.card}>
            <Text style={styles.copy}>History could not be loaded. Retry.</Text>
          </Pressable>
        ) : null}
        {items.map((briefing) => (
          <Pressable
            key={briefing.id}
            onPress={() =>
              router.push({
                pathname: "/briefings/[briefingId]",
                params: { briefingId: briefing.id },
              })
            }
            style={styles.card}
          >
            <Text style={styles.meta}>
              {new Date(briefing.scheduledFor).toLocaleDateString()} ·{" "}
              {Math.ceil(briefing.estimatedSeconds / 60)} min ·{" "}
              {briefing.itemCount} updates
            </Text>
            <Text style={styles.cardTitle}>{briefing.overview}</Text>
            <Text style={styles.link}>Open briefing →</Text>
          </Pressable>
        ))}
        {items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.copy}>No previous briefings yet.</Text>
          </View>
        ) : null}
        {query.hasNextPage ? (
          <Pressable
            disabled={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
            style={styles.card}
          >
            <Text style={styles.link}>
              {query.isFetchingNextPage ? "Loading…" : "Load older briefings"}
            </Text>
          </Pressable>
        ) : null}
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
    },
    title: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 34,
      fontWeight: "400",
      lineHeight: 41,
    },
    card: {
      borderTopColor: palette.border,
      borderTopWidth: 1,
      gap: 10,
      paddingBottom: 12,
      paddingTop: 22,
    },
    meta: { color: palette.accent, fontSize: 11, fontWeight: "800" },
    cardTitle: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 22,
      fontWeight: "400",
      lineHeight: 28,
    },
    copy: { color: palette.textMuted, fontSize: 14 },
    link: { color: palette.accent, fontSize: 13, fontWeight: "800" },
  });
