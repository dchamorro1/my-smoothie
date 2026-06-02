import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase";

type Props = {
  onBack: () => void;
  onAccountLinked: () => void;
};

export default function SignUpScreen({ onBack, onAccountLinked }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    password === confirmPassword &&
    !loading;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setErrorMessage(null);
    Keyboard.dismiss();

    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim(), password });
      if (error) throw error;

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ is_guest_user: false })
          .eq("id", sessionData.session.user.id);
        if (profileError) throw profileError;
      }

      setSuccess(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    onBack();
  };

  if (success) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <View style={styles.form}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a confirmation link to{" "}
              <Text style={styles.emailHighlight}>{email.trim()}</Text>. Click it
              to activate your account — your plants and settings are already saved.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              onPress={onAccountLinked}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Back to home</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backText}>{"<"} Back</Text>
          </Pressable>

          <View style={styles.form}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Link your guest session to a permanent account. Your plants and
              settings will be kept.
            </Text>

            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#879184"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />

            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Password (min. 6 characters)"
              placeholderTextColor="#879184"
              secureTextEntry
              style={[
                styles.input,
                password.length > 0 && password.length < 6 && styles.inputError,
              ]}
              textContentType="newPassword"
              value={password}
            />
            {password.length > 0 && password.length < 6 && (
              <Text style={styles.errorText}>Password must be at least 6 characters.</Text>
            )}

            <TextInput
              autoCapitalize="none"
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor="#879184"
              secureTextEntry
              style={[
                styles.input,
                confirmPassword.length > 0 &&
                  password !== confirmPassword &&
                  styles.inputError,
              ]}
              textContentType="newPassword"
              value={confirmPassword}
            />

            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match.</Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create account"
              disabled={!canSubmit}
              onPress={handleCreate}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </Pressable>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fffef8", flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 22 },
  backButton: { alignSelf: "flex-start", paddingVertical: 12 },
  backText: { color: "#294832", fontSize: 16, fontWeight: "700" },
  form: { flex: 1, justifyContent: "center", paddingBottom: 72 },
  title: {
    color: "#294832",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: "#5f6d5d",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 28,
  },
  emailHighlight: { color: "#294832", fontWeight: "700" },
  input: {
    backgroundColor: "#fff",
    borderColor: "#dfe8d8",
    borderRadius: 14,
    borderWidth: 1,
    color: "#294832",
    fontSize: 17,
    height: 56,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  inputError: { borderColor: "#d32f2f" },
  button: {
    alignItems: "center",
    backgroundColor: "#9bd33e",
    borderRadius: 28,
    height: 58,
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#8ac539",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: "#fff", fontSize: 19, fontWeight: "800" },
  pressed: { opacity: 0.82 },
  errorText: { color: "#d32f2f", fontSize: 14, marginTop: 4, marginBottom: 10 },
});
