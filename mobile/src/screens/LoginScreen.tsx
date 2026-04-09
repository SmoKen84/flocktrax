import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  onLogin: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onResumeSession?: () => Promise<void>;
  hasActiveSession?: boolean;
};

export function LoginScreen({
  onLogin,
  onForgotPassword,
  onResumeSession,
  hasActiveSession = false,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [showNewUserInfo, setShowNewUserInfo] = useState(false);

  async function submit() {
    if (cooldownUntil && cooldownUntil > Date.now()) {
      setLocalError("Too many failed attempts. Wait a moment and try again.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setLocalError("Enter both email and password.");
      return;
    }

    try {
      setSubmitting(true);
      setLocalError(null);
      setLocalMessage(null);
      await onLogin(email.trim(), password, rememberMe);
      setFailedAttempts(0);
      setCooldownUntil(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Login failed.");
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setCooldownUntil(Date.now() + 60_000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      setLocalError("Enter your email first, then tap Forgot Password.");
      return;
    }

    try {
      setSubmitting(true);
      setLocalError(null);
      setLocalMessage(null);
      await onForgotPassword(email.trim());
      setLocalMessage("If that account exists, a password reset email has been sent.");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Unable to send password reset email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resumeSession() {
    if (!onResumeSession) return;

    try {
      setSubmitting(true);
      setLocalError(null);
      setLocalMessage(null);
      await onResumeSession();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Unable to resume session.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", default: undefined })}
      style={styles.wrapper}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>Field Operations</Text>
          <Text style={styles.wordmarkLine}>
            <Text style={styles.wordmarkBrand}>FlockTrax</Text>
            <Text style={styles.wordmarkProduct}>-Mobile</Text>
            <Text style={styles.wordmarkTm}>TM</Text>
          </Text>
          <View style={styles.rule} />
          <Text style={styles.copyright}>
            Copyright (c) 2026 All Rights Reserved. Smotherman Farms, Ltd. (West, Tx)
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.headline}>Barn Data Collection</Text>
          <Text style={styles.copy}>
            Sign in with your FlockTrax system account to access flock placement
            records and record detailed management information.
          </Text>

          <View style={styles.form}>
            {hasActiveSession ? (
              <View style={styles.sessionBanner}>
                <Text style={styles.sessionBannerTitle}>Active session available</Text>
                <Text style={styles.sessionBannerCopy}>
                  Your current session token is still valid. Continue without re-entering credentials.
                </Text>
                <Pressable
                  disabled={submitting}
                  onPress={resumeSession}
                  style={[styles.secondaryButton, submitting && styles.buttonDisabled]}
                >
                  <Text style={styles.secondaryButtonText}>Continue Session</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={submit}
                placeholder="name@farm.com"
                placeholderTextColor="#8A8C86"
                returnKeyType="next"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                onSubmitEditing={submit}
                placeholder="Password"
                placeholderTextColor="#8A8C86"
                returnKeyType="done"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {localError ? <Text style={styles.error}>{localError}</Text> : null}
            {localMessage ? <Text style={styles.message}>{localMessage}</Text> : null}

            <Pressable
              onPress={() => setRememberMe((current) => !current)}
              style={styles.rememberRow}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe ? <Text style={styles.checkboxMark}>X</Text> : null}
              </View>
              <View style={styles.rememberCopy}>
                <Text style={styles.rememberLabel}>Keep me signed in</Text>
                <Text style={styles.rememberHint}>
                  Stay logged in on this device until the session token expires.
                </Text>
              </View>
            </Pressable>

            <Pressable
              disabled={submitting}
              onPress={submit}
              style={[styles.button, submitting && styles.buttonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF8EF" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>

            <View style={styles.linkRow}>
              <Pressable disabled={submitting} onPress={forgotPassword}>
                <Text style={styles.linkText}>Forgot Password?</Text>
              </Pressable>
              <Pressable disabled={submitting} onPress={() => setShowNewUserInfo(true)}>
                <Text style={styles.linkText}>New User?</Text>
              </Pressable>
            </View>

            {cooldownUntil && cooldownUntil > Date.now() ? (
              <Text style={styles.cooldownText}>
                Sign-in is paused for about 1 minute after repeated failed attempts.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerStatus}>Signed out of FlockTrax-Mobile.</Text>
          <Text style={styles.footerMeta}>Release 0.1.0 | Build FLM-2026.04.04-a</Text>
          <Text style={styles.footerMeta}>Release date: April 4, 2026</Text>
        </View>

        <ModalCard
          visible={showNewUserInfo}
          title="Need an Account?"
          body="FlockTrax-Mobile accounts are created by your administrator. Ask them to send your branded invite email so you can activate your login."
          actionLabel="Close"
          onClose={() => setShowNewUserInfo(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModalCard({
  visible,
  title,
  body,
  actionLabel,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  actionLabel: string;
  onClose: () => void;
}) {
  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalBody}>{body}</Text>
          <Pressable onPress={onClose} style={styles.modalButton}>
            <Text style={styles.modalButtonText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 22,
  },
  hero: {
    gap: 6,
    paddingHorizontal: 4,
  },
  kicker: {
    color: "#8B5D32",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  wordmarkLine: {
    fontSize: 0,
  },
  wordmarkBrand: {
    color: "#425CB9",
    fontSize: 29,
    fontWeight: "800",
  },
  wordmarkProduct: {
    color: "#B97743",
    fontSize: 26,
    fontWeight: "500",
  },
  wordmarkTm: {
    color: "#B97743",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 12,
  },
  rule: {
    height: 1,
    backgroundColor: "#D8C9B2",
  },
  copyright: {
    color: "#9D7B59",
    fontSize: 9,
    textAlign: "center",
  },
  card: {
    borderRadius: 28,
    backgroundColor: "#FFF8EF",
    padding: 18,
    borderWidth: 1,
    borderColor: "#DCC9AF",
    gap: 20,
  },
  headline: {
    color: "#211912",
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "800",
  },
  copy: {
    color: "#2B241C",
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 280,
    fontWeight: "600",
  },
  form: {
    gap: 14,
  },
  field: {
    gap: 8,
  },
  label: {
    color: "#5C7155",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7C29E",
    backgroundColor: "#FCF7EF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2A1F",
  },
  button: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: "#8B572A",
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#FFF8EF",
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryButton: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#CDA97E",
    backgroundColor: "#FFF8EF",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#7B4B2A",
    fontSize: 16,
    fontWeight: "800",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  linkText: {
    color: "#6F4A22",
    fontSize: 14,
    fontWeight: "800",
  },
  sessionBanner: {
    borderRadius: 18,
    backgroundColor: "#F8F1E6",
    borderWidth: 1,
    borderColor: "#DEC8A9",
    padding: 14,
    gap: 6,
  },
  sessionBannerTitle: {
    color: "#5C7155",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sessionBannerCopy: {
    color: "#5F625C",
    fontSize: 13,
    lineHeight: 18,
  },
  rememberRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: "#B99D77",
    borderRadius: 5,
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#F0E2CF",
  },
  checkboxMark: {
    color: "#7B4B2A",
    fontSize: 12,
    fontWeight: "800",
  },
  rememberCopy: {
    flex: 1,
    gap: 2,
  },
  rememberLabel: {
    color: "#3E473D",
    fontSize: 14,
    fontWeight: "700",
  },
  rememberHint: {
    color: "#7B7F77",
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    alignItems: "center",
    gap: 4,
    paddingBottom: 4,
  },
  footerStatus: {
    color: "#5D6A5D",
    fontSize: 13,
    fontWeight: "700",
  },
  footerMeta: {
    color: "#8E877B",
    fontSize: 11,
    textAlign: "center",
  },
  error: {
    color: "#982A14",
    fontSize: 14,
    fontWeight: "700",
  },
  message: {
    color: "#3F6530",
    fontSize: 14,
    fontWeight: "700",
  },
  cooldownText: {
    color: "#7A6B56",
    fontSize: 12,
    lineHeight: 18,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(28, 24, 20, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#DCC9AF",
  },
  modalTitle: {
    color: "#211912",
    fontSize: 22,
    fontWeight: "800",
  },
  modalBody: {
    color: "#2B241C",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  modalButton: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: "#8B572A",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    color: "#FFF8EF",
    fontSize: 16,
    fontWeight: "800",
  },
});
