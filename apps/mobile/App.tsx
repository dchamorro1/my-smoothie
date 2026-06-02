import "./src/i18n";

import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import WelcomeScreen from "./src/screens/WelcomeScreen";
import SignInScreen from "./src/screens/SignInScreen";
import OnboardingDifficultyScreen from "./src/screens/OnboardingDifficultyScreen";
import OnboardingAllergiesScreen from "./src/screens/OnboardingAllergiesScreen";
import TabLayout from "./src/components/TabLayout";
import { supabase } from "./utils/supabase";
import { completeOnboarding, fetchUserActivePlants, getProfile } from "./src/services/auth";

type Screen = "loading" | "welcome" | "signIn" | "onboarding_difficulty" | "onboarding_allergies" | "home";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [isGuestUser, setIsGuestUser] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setScreen("welcome");
        return;
      }
      const profile = await getProfile(data.session.access_token).catch(() => null);
      setScreen(profile ? "home" : "onboarding_difficulty");
    };

    restoreSession();
  }, []);

  const handleGuestCreated = (guest: boolean) => {
    setIsGuestUser(guest);
    setScreen("onboarding_difficulty");
  };

  const handleSignedIn = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const profile = await getProfile(data.session.access_token).catch(() => null);
    setScreen(profile ? "home" : "onboarding_difficulty");
  };

  const handleDifficultySelected = (difficulty: string) => {
    setSelectedDifficulty(difficulty);
    setScreen("onboarding_allergies");
  };

  const handleAllergiesSubmitted = async (allergies: string[]) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("No session found.");
    const token = data.session.access_token;

    await completeOnboarding(token, selectedDifficulty!, allergies, isGuestUser);
    await fetchUserActivePlants(token);

    setScreen("home");
  };

  const handleSignOut = () => {
    setScreen("welcome");
    setSelectedDifficulty(null);
    setIsGuestUser(false);
  };

  if (screen === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text>Checking session...</Text>
      </View>
    );
  }

  if (screen === "home") return <TabLayout onSignOut={handleSignOut} />;

  if (screen === "onboarding_difficulty") {
    return (
      <OnboardingDifficultyScreen
        onBack={async () => {
          await supabase.auth.signOut();
          handleSignOut();
        }}
        onContinue={handleDifficultySelected}
      />
    );
  }

  if (screen === "onboarding_allergies") {
    return (
      <OnboardingAllergiesScreen
        onBack={() => setScreen("onboarding_difficulty")}
        onContinue={handleAllergiesSubmitted}
      />
    );
  }

  if (screen === "signIn") {
    return (
      <SignInScreen
        onBack={() => setScreen("welcome")}
        onSignedIn={handleSignedIn}
      />
    );
  }

  return (
    <WelcomeScreen
      onGuestCreated={handleGuestCreated}
      onSignIn={() => setScreen("signIn")}
    />
  );
}
