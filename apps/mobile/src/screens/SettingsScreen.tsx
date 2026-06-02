import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase";
import {
  deleteAccount,
  fetchAllergies,
  getProfile,
  updateAllergies,
  UserProfile,
} from "../services/api";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

const ALLERGENS = [
  { key: "tree_nuts", label: "Tree Nuts" },
  { key: "peanuts",   label: "Peanuts" },
  { key: "wheat",     label: "Wheat" },
  { key: "soybeans",  label: "Soybeans" },
  { key: "sesame",    label: "Sesame" },
];

// ── Allergies bottom sheet ────────────────────────────────────────────────────

type AllergiesSheetProps = {
  visible: boolean;
  onClose: () => void;
  accessToken: string;
};

function AllergiesSheet({ visible, onClose, accessToken }: AllergiesSheetProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noneSelected, setNoneSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchAllergies(accessToken)
      .then((allergies) => {
        if (allergies.length === 0) {
          setNoneSelected(true);
          setSelected(new Set());
        } else {
          setNoneSelected(false);
          setSelected(new Set(allergies));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  const toggle = (key: string) => {
    setNoneSelected(false);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleNone = () => {
    setNoneSelected((prev) => !prev);
    setSelected(new Set());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAllergies(accessToken, noneSelected ? [] : Array.from(selected));
      onClose();
    } catch {
      Alert.alert("Error", "Failed to save allergies. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Allergies</Text>
        <Text style={styles.sheetSubtitle}>
          We'll never recommend a plant that could cause a reaction.
        </Text>

        {loading ? (
          <ActivityIndicator color="#008080" style={{ marginVertical: 24 }} />
        ) : (
          <ScrollView scrollEnabled={false}>
            {ALLERGENS.map(({ key, label }) => {
              const isSelected = selected.has(key);
              return (
                <Pressable
                  key={key}
                  style={[styles.allergenRow, isSelected && styles.allergenRowSelected]}
                  onPress={() => toggle(key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.allergenLabel, isSelected && styles.allergenLabelSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              style={[styles.allergenRow, noneSelected && styles.allergenRowSelected]}
              onPress={toggleNone}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: noneSelected }}
            >
              <View style={[styles.checkbox, noneSelected && styles.checkboxSelected]}>
                {noneSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.allergenLabel, noneSelected && styles.allergenLabelSelected]}>
                None of the above
              </Text>
            </Pressable>
          </ScrollView>
        )}

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving || loading}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save changes</Text>
          )}
        </Pressable>

        <Pressable onPress={onClose} style={styles.cancelButton} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ── Settings screen ───────────────────────────────────────────────────────────

type Props = {
  onSignOut: () => void;
  onLinkAccount: () => void;
};

export default function SettingsScreen({ onSignOut, onLinkAccount }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [showAllergies, setShowAllergies] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        setToken(data.session.access_token);
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
          { text: "Sign Out & Delete Data", style: "destructive", onPress: confirmGuestSignOut },
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
      if (data.session) await deleteAccount(data.session.access_token);
    } catch {}
    finally {
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
        <Text style={styles.sectionLabel}>HEALTH</Text>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => setShowAllergies(true)}
          accessibilityRole="button"
        >
          <Text style={styles.rowLabel}>Allergies</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
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

      {token && (
        <AllergiesSheet
          visible={showAllergies}
          onClose={() => setShowAllergies(false)}
          accessToken={token}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  rowValue: { fontSize: 16, color: "#888", flex: 1, textAlign: "right" },
  rowChevron: { fontSize: 20, color: "#bbb" },
  guestWarningText: {
    fontSize: 13, color: "#888", lineHeight: 18,
    marginHorizontal: 20, marginTop: 8,
  },
  signOutRow: { justifyContent: "center" },
  signOutText: { fontSize: 16, color: "#c00", fontWeight: "500" },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, color: "#888", marginBottom: 20 },
  allergenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
    gap: 14,
  },
  allergenRowSelected: { },
  allergenLabel: { fontSize: 16, color: "#111" },
  allergenLabelSelected: { color: "#008080", fontWeight: "500" },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: "#ccc",
    alignItems: "center", justifyContent: "center",
  },
  checkboxSelected: { borderColor: "#008080", backgroundColor: "#008080" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  saveButton: {
    backgroundColor: "#008080",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButton: { alignItems: "center", paddingVertical: 14 },
  cancelText: { fontSize: 15, color: "#888" },
});
