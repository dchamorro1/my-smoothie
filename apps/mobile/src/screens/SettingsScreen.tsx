import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase";
import { getProfile } from "../services/auth";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

type Props = {
  onSignOut: () => void;
};

export default function SettingsScreen({ onSignOut }: Props) {
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const profile = await getProfile(data.session.access_token);
        setDifficulty(profile?.difficulty_level ?? null);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
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
              {difficulty ? DIFFICULTY_LABELS[difficulty] ?? difficulty : "—"}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
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
  signOutRow: { justifyContent: "center" },
  signOutText: { fontSize: 16, color: "#c00", fontWeight: "500" },
});
