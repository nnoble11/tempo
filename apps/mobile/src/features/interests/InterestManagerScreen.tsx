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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppNavigation palette={palette} />
        <Text style={styles.eyebrow}>YOUR SIGNAL</Text>
        <Text style={styles.title}>Interests should evolve with you.</Text>
        <Text style={styles.help}>
          Add topics, entities, or natural-language rules. Muting is reversible;
          deletion removes the interest from future briefings while preserving
          historical briefing evidence.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add an interest</Text>
          <View style={styles.row}>
            {(["topic", "entity", "instruction"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setType(value)}
                style={[styles.chip, type === value && styles.chipSelected]}
              >
                <Text style={styles.chipText}>
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
            style={styles.input}
            value={name}
          />
          <Action
            label={create.isPending ? "Adding…" : "Add interest"}
            disabled={create.isPending || name.trim().length === 0}
            onPress={add}
            styles={styles}
          />
        </View>

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
            onSave={(input) =>
              update
                .mutateAsync({ id: interest.id, input })
                .then(() => setMessage("Interest updated."))
                .catch(() => setMessage("Could not update interest."))
            }
          />
        ))}
        {message === null ? null : (
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InterestCard({
  interest,
  palette,
  busy,
  onSave,
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
  }) => Promise<unknown>;
  onDelete: () => void;
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [name, setName] = useState(interest.name);
  const [description, setDescription] = useState(interest.description ?? "");
  const [importance, setImportance] = useState(interest.importance);
  const [depth, setDepth] = useState(interest.desiredDepth);
  const update = useUpdateInterest();

  return (
    <View style={[styles.card, !interest.active && styles.cardMuted]}>
      <Text style={styles.type}>{interest.type.toUpperCase()}</Text>
      <TextInput
        accessibilityLabel={`${interest.name} name`}
        onChangeText={setName}
        style={styles.input}
        value={name}
      />
      <TextInput
        accessibilityLabel={`${interest.name} description`}
        multiline
        onChangeText={setDescription}
        placeholder="Optional guidance"
        placeholderTextColor={palette.textMuted}
        style={styles.input}
        value={description}
      />
      <Text style={styles.help}>Importance</Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            onPress={() => setImportance(value)}
            style={[styles.chip, importance === value && styles.chipSelected]}
          >
            <Text style={styles.chipText}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.help}>Depth</Text>
      <View style={styles.row}>
        {(["brief", "standard", "deep"] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setDepth(value)}
            style={[styles.chip, depth === value && styles.chipSelected]}
          >
            <Text style={styles.chipText}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <Action
          label="Save edits"
          disabled={busy || name.trim().length === 0}
          onPress={() =>
            onSave({
              name: name.trim(),
              description:
                description.trim().length === 0 ? null : description.trim(),
              importance,
              desiredDepth: depth,
            })
          }
          styles={styles}
        />
        <Action
          label={interest.active ? "Mute" : "Reactivate"}
          disabled={busy || update.isPending}
          onPress={() =>
            update.mutateAsync({
              id: interest.id,
              input: { active: !interest.active },
            })
          }
          styles={styles}
        />
        <Pressable disabled={busy} onPress={onDelete} style={styles.textAction}>
          <Text style={styles.delete}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Action({
  label,
  disabled,
  onPress,
  styles,
}: {
  label: string;
  disabled: boolean;
  onPress: () => unknown;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      style={styles.action}
    >
      <Text style={styles.actionText}>{label}</Text>
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
    help: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 12,
      padding: 18,
    },
    cardMuted: { opacity: 0.64 },
    cardTitle: { color: palette.text, fontSize: 20, fontWeight: "800" },
    type: { color: palette.accent, fontSize: 10, fontWeight: "800" },
    input: {
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderRadius: 10,
      borderWidth: 1,
      color: palette.text,
      fontSize: 15,
      padding: 12,
    },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderColor: palette.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    chipSelected: { backgroundColor: palette.accentSoft },
    chipText: { color: palette.text, fontSize: 12, fontWeight: "700" },
    action: {
      backgroundColor: palette.accent,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    actionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    textAction: { paddingHorizontal: 8, paddingVertical: 10 },
    delete: { color: palette.negative, fontSize: 12, fontWeight: "800" },
    error: { color: palette.negative },
    message: { color: palette.accent, fontSize: 14, fontWeight: "700" },
  });
