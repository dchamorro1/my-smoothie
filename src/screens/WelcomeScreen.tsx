import { StatusBar } from "expo-status-bar";
import { Pressable, SafeAreaView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import BrandLogo from "../components/welcome/BrandLogo";
import HeroArt from "../components/welcome/HeroArt";
import styles from "../components/welcome/welcomeStyles";

export default function WelcomeScreen() {
  const { t } = useTranslation();

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
          >
            <Text style={styles.buttonText}>{t("welcome.getStarted")}</Text>
            <Text style={styles.buttonArrow}>{">"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
