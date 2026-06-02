import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase";
import { deleteAccount, getProfile, UserProfile } from "../services/auth";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

type Props = {
  onSignOut: () => void;
  onLinkAccount: () => void;
};

export default function SettingsScreen({ onSignOut, onLinkAccount }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        setEmail(data.session.user.email ?? null);
        const p = await getProfile(data.session.access_token);
        setProfile(p);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSignOut = async () => {
    if (profile?.is_guest_user) {
      Alert.alert(
        "Sign out as guest?",
        "You're using a guest account. Signing out will permanently delete your data — your active plants, allergies, and settings will be lost.\n\nCreate an account first to save your progress.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign Out & Delete Data",
            style: "destructive",
            onPress: confirmGuestSignOut,
          },
        ]
      );
    } else {
      await supabase.auth.signOut();
      onSignOut();
    }
  };

  const confirmGuestSignOut = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await deleteAccount(data.session.access_token);
      }
    } catch {
      // Even if deletion fails, sign out anyway
    } finally {
      await supabase.auth.signOut();
      onSignOut();
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EXPERIENCE LEVEL</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Difficulty</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#008080" />
          ) : (
            <Text style={styles.rowValue}>
              {profile?.difficulty_level
                ? DIFFICULTY_LABELS[profile.difficulty_level] ?? profile.difficulty_level
                : "—"}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        {profile?.is_guest_user ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={onLinkAccount}
              accessibilityRole="button"
            >
              <Text style={styles.rowLabel}>Link to account</Text>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
            <Text style={styles.guestWarningText}>
              Save your plants and settings permanently with an email and password.
            </Text>
          </>
        ) : (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Signed in as</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{email ?? "—"}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Pressable
          style={({ pressed }) => [styles.row, styles.signOutRow, pressed && styles.rowPressed]}
          onPress={handleSignOut}
          accessibilityRole="button"
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f2f7" },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#111",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  section: { marginBottom: 32 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  row: {
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  rowPressed: { backgroundColor: "#f0f0f0" },
  rowLabel: { fontSize: 16, color: "#111" },
  rowValue: { fontSize: 16, color: "#888" },
  rowChevron: { fontSize: 20, color: "#bbb" },
  guestWarningText: {
    fontSize: 13,
    color: "#888",
    lineHeight: 18,
    marginHorizontal: 20,
    marginTop: 8,
  },
  signOutRow: { justifyContent: "center" },
  signOutText: { fontSize: 16, color: "#c00", fontWeight: "500" },
});
