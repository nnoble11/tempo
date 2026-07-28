import {
  type DesiredDepth,
  type InterestType,
  type UserInterest,
} from "@tempo/contracts";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppNavigation } from "../../components/AppNavigation";
import { darkPalette, lightPalette, type TempoPalette } from "../../theme";
import {
  useCreateInterest,
  useDeleteInterest,
  useInterests,
  useUpdateInterest,
} from "./hooks";

export function InterestManagerScreen() {
  const palette = useColorScheme() === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const query = useInterests();
  const create = useCreateInterest();
  const update = useUpdateInterest();
  const remove = useDeleteInterest();
  const [name, setName] = useState("");
  const [type, setType] = useState<InterestType>("topic");
  const [message, setMessage] = useState<string | null>(null);

  const add = async (): Promise<void> => {
    if (name.trim().length === 0) return;
    setMessage(null);
    try {
      await create.mutateAsync({
        type,
        name: name.trim(),
        description: type === "instruction" ? name.trim() : "Managed in Tempo",
        importance: 3,
        expertiseLevel: "intermediate",
        desiredDepth: "standard",
        alertSensitivity: 1,
        preferredSources: [],
        blockedSources: [],
        keywords: [],
        excludedKeywords: [],
      });
      setName("");
      setMessage("Interest added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add.");
    }
  };

  if (query.isPending) {
    return (
      <SafeAreaView style={styles.state}>
        <ActivityIndicator color={palette.accent} />
        <Text style={styles.stateText}>Loading your interests…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppNavigation palette={palette} />
        <Text style={styles.eyebrow}>YOUR SIGNAL</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Interests should evolve with you.
        </Text>
        <Text style={styles.help}>
          Shape what earns a place in your briefing. Muting is reversible, and
          deletion never changes your past briefings.
        </Text>

        <View style={[styles.card, styles.addCard]}>
          <Text style={styles.type}>ADD SOMETHING NEW</Text>
          <Text style={styles.cardTitle}>Add an interest</Text>
          <View style={styles.row}>
            {(["topic", "entity", "instruction"] as const).map((value) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: type === value }}
                key={value}
                onPress={() => setType(value)}
                style={[styles.chip, type === value && styles.chipSelected]}
              >
                <Text
                  style={[
                    styles.chipText,
                    type === value && styles.chipTextSelected,
                  ]}
                >
                  {value === "instruction" ? "Natural-language rule" : value}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="New interest"
            multiline={type === "instruction"}
            onChangeText={setName}
            placeholder={
              type === "instruction"
                ? "Tell me about… but skip…"
                : `Add a ${type}`
            }
            placeholderTextColor={palette.textMuted}
            style={[
              styles.input,
              type === "instruction" && styles.multilineInput,
            ]}
            value={name}
          />
          <Action
            label={create.isPending ? "Adding…" : "Add interest"}
            disabled={create.isPending || name.trim().length === 0}
            onPress={add}
            styles={styles}
          />
        </View>

        {message === null ? null : (
          <View accessibilityRole="alert" style={styles.notice}>
            <Text style={styles.message}>{message}</Text>
          </View>
        )}

        {query.isError ? (
          <View style={styles.card}>
            <Text style={styles.error}>Interests could not be loaded.</Text>
            <Action
              label="Retry"
              disabled={query.isRefetching}
              onPress={() => query.refetch()}
              styles={styles}
            />
          </View>
        ) : null}

        {query.data === undefined || query.data.items.length === 0 ? null : (
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Your interests</Text>
            <Text style={styles.count}>
              {query.data.items.length}{" "}
              {query.data.items.length === 1 ? "interest" : "interests"}
            </Text>
          </View>
        )}

        {query.data?.items.map((interest) => (
          <InterestCard
            interest={interest}
            key={interest.id}
            palette={palette}
            busy={update.isPending || remove.isPending}
            onDelete={() =>
              Alert.alert(
                "Delete this interest?",
                "It will disappear from future briefing selection. Existing briefing history remains intact.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                      void remove
                        .mutateAsync(interest.id)
                        .then(() => setMessage("Interest deleted."))
                        .catch(() => setMessage("Could not delete interest.")),
                  },
                ],
              )
            }
            onSave={async (input) => {
              try {
                await update.mutateAsync({ id: interest.id, input });
                setMessage("Interest updated.");
              } catch (error) {
                setMessage("Could not update interest.");
                throw error;
              }
            }}
            onToggleActive={async () => {
              try {
                await update.mutateAsync({
                  id: interest.id,
                  input: { active: !interest.active },
                });
                setMessage(
                  interest.active ? "Interest muted." : "Interest reactivated.",
                );
              } catch {
                setMessage("Could not update interest.");
              }
            }}
          />
        ))}

        {!query.isError && query.data.items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Start with one clear signal.</Text>
            <Text style={styles.help}>
              Add a topic, entity, or rule above. Tempo works best when each
              interest says exactly what you want to know.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InterestCard({
  interest,
  palette,
  busy,
  onSave,
  onToggleActive,
  onDelete,
}: {
  interest: UserInterest;
  palette: TempoPalette;
  busy: boolean;
  onSave: (input: {
    name: string;
    description: string | null;
    importance: number;
    desiredDepth: DesiredDepth;
  }) => Promise<void>;
  onToggleActive: () => Promise<void>;
  onDelete: () => void;
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(interest.name);
  const [description, setDescription] = useState(interest.description ?? "");
  const [importance, setImportance] = useState(interest.importance);
  const [depth, setDepth] = useState(interest.desiredDepth);

  return (
    <View style={[styles.card, !interest.active && styles.cardMuted]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.type}>{interest.type.toUpperCase()}</Text>
          <Text accessibilityRole="header" style={styles.interestName}>
            {interest.name}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            interest.active ? styles.statusActive : styles.statusMuted,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              !interest.active && styles.statusTextMuted,
            ]}
          >
            {interest.active ? "ACTIVE" : "MUTED"}
          </Text>
        </View>
      </View>

      {isEditing ? (
        <>
          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput
            accessibilityLabel={`${interest.name} name`}
            onChangeText={setName}
            style={styles.input}
            value={name}
          />
          <Text style={styles.fieldLabel}>GUIDANCE</Text>
          <TextInput
            accessibilityLabel={`${interest.name} description`}
            multiline
            onChangeText={setDescription}
            placeholder="Optional guidance"
            placeholderTextColor={palette.textMuted}
            style={[styles.input, styles.multilineInput]}
            value={description}
          />
          <Text style={styles.fieldLabel}>IMPORTANCE</Text>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                accessibilityLabel={`Importance ${value} of 5`}
                accessibilityRole="tab"
                accessibilityState={{ selected: importance === value }}
                key={value}
                onPress={() => setImportance(value)}
                style={[
                  styles.numberChip,
                  importance === value && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    importance === value && styles.chipTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>DEPTH</Text>
          <View style={styles.row}>
            {(["brief", "standard", "deep"] as const).map((value) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: depth === value }}
                key={value}
                onPress={() => setDepth(value)}
                style={[styles.chip, depth === value && styles.chipSelected]}
              >
                <Text
                  style={[
                    styles.chipText,
                    depth === value && styles.chipTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <Action
              label="Save changes"
              disabled={busy || name.trim().length === 0}
              onPress={async () => {
                try {
                  await onSave({
                    name: name.trim(),
                    description:
                      description.trim().length === 0
                        ? null
                        : description.trim(),
                    importance,
                    desiredDepth: depth,
                  });
                  setIsEditing(false);
                } catch {
                  // Keep the editor open so the user can retry.
                }
              }}
              styles={styles}
            />
            <Action
              label="Cancel"
              disabled={busy}
              onPress={() => {
                setName(interest.name);
                setDescription(interest.description ?? "");
                setImportance(interest.importance);
                setDepth(interest.desiredDepth);
                setIsEditing(false);
              }}
              styles={styles}
              variant="secondary"
            />
          </View>
        </>
      ) : (
        <>
          {interest.description === null ? null : (
            <Text style={styles.description}>{interest.description}</Text>
          )}
          <Text style={styles.metadata}>
            Importance {interest.importance}/5 ·{" "}
            {interest.desiredDepth.charAt(0).toUpperCase()}
            {interest.desiredDepth.slice(1)} depth
          </Text>
          <View style={styles.cardActions}>
            <Action
              label="Edit"
              disabled={busy}
              onPress={() => setIsEditing(true)}
              styles={styles}
              variant="secondary"
            />
            <Action
              label={interest.active ? "Mute" : "Reactivate"}
              disabled={busy}
              onPress={onToggleActive}
              styles={styles}
              variant="secondary"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={onDelete}
              style={({ pressed }) => [
                styles.textAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function Action({
  label,
  disabled,
  onPress,
  styles,
  variant = "primary",
}: {
  label: string;
  disabled: boolean;
  onPress: () => unknown;
  styles: ReturnType<typeof createStyles>;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => void onPress()}
      style={({ pressed }) => [
        styles.action,
        variant === "secondary" && styles.actionSecondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          variant === "secondary" && styles.actionTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    safeArea: { backgroundColor: palette.background, flex: 1 },
    state: {
      alignItems: "center",
      backgroundColor: palette.background,
      flex: 1,
      gap: 12,
      justifyContent: "center",
    },
    stateText: { color: palette.textMuted, fontSize: 14 },
    content: {
      alignSelf: "center",
      gap: 14,
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
      marginTop: 6,
    },
    title: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 34,
      fontWeight: "400",
      letterSpacing: -0.8,
      lineHeight: 41,
    },
    help: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
    card: {
      borderTopColor: palette.border,
      borderTopWidth: 1,
      gap: 13,
      paddingBottom: 10,
      paddingTop: 22,
    },
    addCard: { marginBottom: 10, marginTop: 8 },
    cardMuted: { borderStyle: "dashed" },
    cardTitle: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 22,
      fontWeight: "400",
    },
    type: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.2,
    },
    cardHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
    },
    cardHeaderCopy: { flex: 1, gap: 7 },
    interestName: {
      color: palette.text,
      fontFamily: "Georgia",
      fontSize: 22,
      fontWeight: "400",
      lineHeight: 28,
    },
    statusPill: {
      borderColor: palette.border,
      borderRadius: 2,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    statusActive: { backgroundColor: palette.accentSoft },
    statusMuted: { backgroundColor: palette.surfaceMuted },
    statusText: {
      color: palette.accent,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    statusTextMuted: { color: palette.textMuted },
    description: {
      color: palette.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    metadata: {
      color: palette.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    fieldLabel: {
      color: palette.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginTop: 3,
    },
    input: {
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderRadius: 2,
      borderWidth: 1,
      color: palette.text,
      fontSize: 15,
      minHeight: 48,
      padding: 12,
    },
    multilineInput: { minHeight: 88, textAlignVertical: "top" },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    cardActions: {
      alignItems: "center",
      borderTopColor: palette.border,
      borderTopWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 2,
      paddingTop: 14,
    },
    chip: {
      borderColor: palette.border,
      borderRadius: 2,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    numberChip: {
      alignItems: "center",
      borderColor: palette.border,
      borderRadius: 2,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 42,
      minWidth: 42,
    },
    chipSelected: {
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent,
    },
    chipText: { color: palette.text, fontSize: 12, fontWeight: "700" },
    chipTextSelected: { color: palette.accent },
    action: {
      alignItems: "center",
      backgroundColor: palette.accent,
      borderColor: palette.accent,
      borderRadius: 2,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    actionText: {
      color: palette.background,
      fontSize: 12,
      fontWeight: "800",
    },
    actionSecondary: { backgroundColor: "transparent" },
    actionTextSecondary: { color: palette.accent },
    textAction: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 9,
    },
    delete: { color: palette.negative, fontSize: 12, fontWeight: "800" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.62 },
    error: { color: palette.negative, fontSize: 14, lineHeight: 20 },
    notice: {
      backgroundColor: palette.accentSoft,
      borderLeftColor: palette.accent,
      borderLeftWidth: 3,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    message: { color: palette.accent, fontSize: 13, fontWeight: "700" },
    listHeader: {
      alignItems: "baseline",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
    },
    listTitle: { color: palette.text, fontSize: 20, fontWeight: "700" },
    count: { color: palette.textMuted, fontSize: 12, fontWeight: "600" },
    emptyCard: {
      alignItems: "center",
      borderColor: palette.border,
      borderRadius: 2,
      borderStyle: "dashed",
      borderWidth: 1,
      gap: 8,
      padding: 28,
    },
    emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
  });
