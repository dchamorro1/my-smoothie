import { StatusBar } from "expo-status-bar";
import { Pressable, SafeAreaView, Text, View } from "react-native";

import BrandLogo from "../components/welcome/BrandLogo";
import HeroArt from "../components/welcome/HeroArt";
import styles from "../components/welcome/welcomeStyles";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <BrandLogo />

        <HeroArt />

        <View style={styles.footer}>
          <Text style={styles.welcome}>Welcome!</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Let's Get Started</Text>
            <Text style={styles.buttonArrow}>{">"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
