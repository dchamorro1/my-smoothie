import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import BrandLogo from "../components/welcome/BrandLogo";
import HeroArt from "../components/welcome/HeroArt";
import styles from "../components/welcome/welcomeStyles";
import { signUpGuest } from "../services/auth";

type Props = {
  onGuestCreated: () => void;
  onSignIn: () => void;
};

export default function WelcomeScreen({ onGuestCreated, onSignIn }: Props) {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGetStarted = async () => {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      await signUpGuest();
      onGuestCreated();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create guest account.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <BrandLogo />

        <HeroArt />

        <View style={styles.footer}>
          <Text style={styles.welcome}>{t("welcome.title")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("welcome.getStarted")}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGetStarted}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>{t("welcome.getStarted")}</Text>
                <Text style={styles.buttonArrow}>{">"}</Text>
              </>
            )}
          </Pressable>
          <View style={styles.signInRow}>
            <Text style={styles.signInPrompt}>{t("welcome.signInPrompt")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("welcome.signIn")}
              onPress={onSignIn}
              style={({ pressed }) => pressed && styles.signInPressed}
            >
              <Text style={styles.signInLink}>{t("welcome.signIn")}</Text>
            </Pressable>
          </View>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
