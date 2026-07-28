import { usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

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
  const pathname = usePathname();

  const isActive = (href: (typeof destinations)[number]["href"]): boolean =>
    href === "/"
      ? pathname === "/" || pathname.startsWith("/briefings/")
      : pathname === href;

  return (
    <ScrollView
      accessibilityLabel="Tempo sections"
      contentContainerStyle={[
        styles.row,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {destinations.map((destination) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: isActive(destination.href) }}
          key={destination.href}
          onPress={() => router.push(destination.href)}
          style={({ pressed }) => [
            styles.link,
            isActive(destination.href) && {
              backgroundColor: palette.accentSoft,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.text,
              {
                color: isActive(destination.href)
                  ? palette.accent
                  : palette.textMuted,
              },
            ]}
          >
            {destination.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    padding: 4,
  },
  link: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  text: { fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.62 },
});
