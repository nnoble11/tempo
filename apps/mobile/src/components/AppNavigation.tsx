import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TempoPalette } from "../theme";

const destinations = [
  { label: "Today", href: "/" },
  { label: "Interests", href: "/interests" },
  { label: "Saved", href: "/saved" },
  { label: "Later", href: "/later" },
  { label: "History", href: "/history" },
  { label: "Calendar", href: "/calendar" },
  { label: "Settings", href: "/settings" },
] as const;

export function AppNavigation({ palette }: { palette: TempoPalette }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      {destinations.map((destination) => (
        <Pressable
          accessibilityRole="button"
          key={destination.href}
          onPress={() => router.push(destination.href)}
          style={[styles.link, { borderColor: palette.border }]}
        >
          <Text style={[styles.text, { color: palette.accent }]}>
            {destination.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 12,
  },
  link: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  text: { fontSize: 12, fontWeight: "700" },
});
