import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../auth/AuthProvider";
import { darkPalette, lightPalette, type TempoPalette } from "../../theme";

type AuthMode = "sign_in" | "sign_up";

export function SignInScreen() {
  const palette = useColorScheme() === "dark" ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const submit = async (): Promise<void> => {
    if (!email.includes("@") || password.length < 6) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "sign_in") {
        await signIn(email.trim(), password);
      } else {
        const result = await signUp(email.trim(), password);
        setConfirmationSent(result.requiresEmailConfirmation);
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Tempo could not authenticate this account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmationSent) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Text style={styles.wordmark}>tempo</Text>
        <Text style={styles.eyebrow}>ONE QUICK STEP</Text>
        <Text accessibilityRole="header" style={styles.stateTitle}>
          Check your inbox.
        </Text>
        <Text style={styles.copy}>
          Confirm {email.trim()} and then return here to sign in.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setConfirmationSent(false);
            setMode("sign_in");
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Back to sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <Text style={styles.wordmark}>tempo</Text>
            <Text accessibilityRole="header" style={styles.title}>
              The right amount of what matters.
            </Text>
            <Text style={styles.copy}>
              A calm daily briefing that fits the time you actually have.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.modeRow}>
              {(["sign_in", "sign_up"] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === option }}
                  onPress={() => {
                    setMode(option);
                    setError(null);
                  }}
                  style={[
                    styles.modeButton,
                    mode === option && styles.modeButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      mode === option && styles.modeTextSelected,
                    ]}
                  >
                    {option === "sign_in" ? "Sign in" : "Create account"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={palette.textMuted}
              returnKeyType="next"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete={
                mode === "sign_in" ? "current-password" : "new-password"
              }
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              placeholder="At least 6 characters"
              placeholderTextColor={palette.textMuted}
              returnKeyType="go"
              secureTextEntry
              style={styles.input}
              textContentType={mode === "sign_in" ? "password" : "newPassword"}
              value={password}
            />

            {error === null ? null : (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || isSubmitting) && styles.pressed,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === "sign_in" ? "Open Tempo" : "Create my account"}
                </Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.privacy}>
            Your interests and reading behavior stay personal. Tempo does not
            sell them or use them for disguised advertising.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: TempoPalette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    safeArea: {
      backgroundColor: palette.background,
      flex: 1,
    },
    content: {
      alignItems: "center",
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 36,
    },
    intro: {
      maxWidth: 480,
      width: "100%",
    },
    wordmark: {
      color: palette.accent,
      fontSize: 38,
      fontWeight: "800",
      letterSpacing: -2,
    },
    eyebrow: {
      color: palette.accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.7,
    },
    title: {
      color: palette.text,
      fontSize: 34,
      fontWeight: "700",
      letterSpacing: -1.2,
      lineHeight: 39,
      marginTop: 18,
    },
    stateTitle: {
      color: palette.text,
      fontSize: 32,
      fontWeight: "700",
      letterSpacing: -1,
      lineHeight: 38,
      marginTop: 18,
      textAlign: "center",
    },
    copy: {
      color: palette.textMuted,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 14,
    },
    form: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 22,
      borderWidth: 1,
      marginTop: 28,
      maxWidth: 480,
      padding: 22,
      width: "100%",
    },
    modeRow: {
      backgroundColor: palette.surfaceMuted,
      borderRadius: 12,
      flexDirection: "row",
      marginBottom: 22,
      padding: 3,
    },
    modeButton: {
      alignItems: "center",
      borderRadius: 10,
      flex: 1,
      paddingVertical: 10,
    },
    modeButtonSelected: {
      backgroundColor: palette.surface,
    },
    modeText: {
      color: palette.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    modeTextSelected: {
      color: palette.text,
    },
    label: {
      color: palette.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.4,
      marginBottom: 7,
      marginTop: 13,
    },
    input: {
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderRadius: 12,
      borderWidth: 1,
      color: palette.text,
      fontSize: 16,
      minHeight: 50,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    error: {
      color: palette.negative,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 14,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: palette.accent,
      borderRadius: 14,
      minHeight: 50,
      justifyContent: "center",
      marginTop: 20,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    primaryButtonText: {
      color: palette.background,
      fontSize: 15,
      fontWeight: "800",
    },
    pressed: {
      opacity: 0.7,
    },
    privacy: {
      color: palette.textMuted,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 24,
      maxWidth: 420,
      textAlign: "center",
      width: "100%",
    },
    stateScreen: {
      alignItems: "center",
      backgroundColor: palette.background,
      flex: 1,
      justifyContent: "center",
      padding: 28,
    },
  });
