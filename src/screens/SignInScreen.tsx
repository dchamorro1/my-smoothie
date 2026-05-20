import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { signInWithEmail } from "../services/auth";

type Props = {
  onBack: () => void;
  onSignedIn: () => void;
};

export default function SignInScreen({ onBack, onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSigningIn;

  const handleSignIn = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSigningIn(true);
    setErrorMessage(null);

    try {
      await signInWithEmail(email, password);
      onSignedIn();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to sign in.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

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
            accessibilityLabel="Back to welcome"
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backText}>{"<"} Back</Text>
          </Pressable>

          <View style={styles.form}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>Use the email and password for your account.</Text>

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
              placeholder="Password"
              placeholderTextColor="#879184"
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              disabled={!canSubmit}
              onPress={handleSignIn}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
            >
              {isSigningIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#fffef8",
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 22,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 12,
  },
  backText: {
    color: "#294832",
    fontSize: 16,
    fontWeight: "700",
  },
  form: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 72,
  },
  title: {
    color: "#294832",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 10,
  },
  subtitle: {
    color: "#5f6d5d",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 28,
  },
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
  buttonDisabled: {
    opacity: 0.48,
  },
  buttonText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.82,
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    marginTop: 14,
    textAlign: "center",
  },
});
