import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TempoPalette } from "../theme";

const primaryDestinations = [
  { label: "Today", href: "/" },
  { label: "Library", href: "/saved" },
  { label: "Interests", href: "/interests" },
  { label: "Calendar", href: "/calendar" },
  { label: "Settings", href: "/settings" },
] as const;

const libraryDestinations = [
  { label: "Saved", href: "/saved" },
  { label: "Later", href: "/later" },
  { label: "History", href: "/history" },
] as const;

const isLibraryPath = (pathname: string): boolean =>
  pathname === "/saved" || pathname === "/later" || pathname === "/history";

const isPrimaryActive = (pathname: string, href: string): boolean => {
  if (href === "/") return pathname === "/";
  if (href === "/saved") return isLibraryPath(pathname);
  return pathname === href;
};

export function AppNavigation({
  palette,
  variant = "contextual",
}: {
  palette: TempoPalette;
  variant?: "primary" | "contextual";
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  if (pathname.startsWith("/briefings/")) return null;
  if (variant === "contextual" && !isLibraryPath(pathname)) return null;

  const destinations =
    variant === "primary" ? primaryDestinations : libraryDestinations;

  return (
    <View
      accessibilityLabel={
        variant === "primary" ? "Primary navigation" : "Library navigation"
      }
      style={[
        variant === "primary" ? styles.primaryRow : styles.contextRow,
        {
          backgroundColor:
            variant === "primary" ? palette.surface : "transparent",
          borderColor: palette.border,
          paddingBottom: variant === "primary" ? Math.max(insets.bottom, 8) : 0,
        },
      ]}
    >
      {destinations.map((destination) => {
        const active =
          variant === "primary"
            ? isPrimaryActive(pathname, destination.href)
            : pathname === destination.href;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={4}
            key={destination.href}
            onPress={() => {
              if (active) return;
              router.replace(destination.href);
            }}
            style={({ pressed }) => [
              variant === "primary" ? styles.primaryLink : styles.contextLink,
              { borderColor: active ? palette.text : "transparent" },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: active ? palette.text : palette.textMuted },
              ]}
            >
              {destination.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  primaryRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingTop: 3,
  },
  primaryLink: {
    alignItems: "center",
    borderTopWidth: 2,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 2,
    paddingTop: 7,
  },
  contextRow: {
    alignItems: "center",
    alignSelf: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 24,
  },
  contextLink: {
    borderBottomWidth: 2,
    justifyContent: "center",
    minHeight: 44,
    paddingTop: 2,
  },
  text: { fontSize: 12, fontWeight: "600", letterSpacing: 0.1 },
  pressed: { opacity: 0.5 },
});
