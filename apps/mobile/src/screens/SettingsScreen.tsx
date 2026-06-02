import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../utils/supabase";
import {
  deleteAccount,
  fetchAllergies,
  getProfile,
  updateAllergies,
  updateDifficulty,
  UserProfile,
} from "../services/api";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

const DIFFICULTY_OPTIONS = [
  { key: "beginner",     label: "Beginner",     description: "2 new plants at a time" },
  { key: "intermediate", label: "Intermediate", description: "3 new plants at a time" },
  { key: "advanced",     label: "Advanced",     description: "4 new plants at a time" },
  { key: "expert",       label: "Expert",       description: "5 new plants at a time" },
];

const ALLERGENS = [
  { key: "tree_nuts", label: "Tree Nuts" },
  { key: "peanuts",   label: "Peanuts" },
  { key: "wheat",     label: "Wheat" },
  { key: "soybeans",  label: "Soybeans" },
  { key: "sesame",    label: "Sesame" },
];

// ── Reusable bottom sheet ─────────────────────────────────────────────────────

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

const SHEET_CLOSED_Y = 600;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  // Single value drives both the slide animation and the drag; backdrop derives from it.
  const translateY = useRef(new Animated.Value(SHEET_CLOSED_Y)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SHEET_CLOSED_Y);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false,
      }).start();
    } else if (mounted) {
      Animated.timing(translateY, {
        toValue: SHEET_CLOSED_Y,
        duration: 240,
        useNativeDriver: false,
      }).start(() => setMounted(false));
    }
  }, [visible]);

  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    const ty = e.nativeEvent.translationY;
    if (ty > 0) translateY.setValue(ty);
  };

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.state !== State.END) return;
    const { translationY, velocityY } = e.nativeEvent;
    if (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) {
      onClose();
    } else {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 0,
      }).start();
    }
  };

  if (!mounted) return null;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SHEET_CLOSED_Y],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
          <Animated.View
            style={[
              styles.sheetContainer,
              { paddingBottom: insets.bottom + 16, transform: [{ translateY }] },
            ]}
          >
            <View style={styles.sheetHandle} />
            {children}
          </Animated.View>
        </PanGestureHandler>
      </View>
    </Modal>
  );
}

// ── Allergies bottom sheet ────────────────────────────────────────────────────

type AllergiesSheetProps = {
  visible: boolean;
  onClose: () => void;
  accessToken: string;
};

function AllergiesSheet({ visible, onClose, accessToken }: AllergiesSheetProps) {
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
    <BottomSheet visible={visible} onClose={onClose}>
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
                style={styles.allergenRow}
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
            style={styles.allergenRow}
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
    </BottomSheet>
  );
}

// ── Difficulty bottom sheet ───────────────────────────────────────────────────

type DifficultySheetProps = {
  visible: boolean;
  onClose: () => void;
  accessToken: string;
  current: string | null;
  onSaved: (level: string) => void;
};

function DifficultySheet({ visible, onClose, accessToken, current, onSaved }: DifficultySheetProps) {
  const [selected, setSelected] = useState<string | null>(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSelected(current);
  }, [visible, current]);

  const handleSave = async () => {
    if (!selected || selected === current) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateDifficulty(accessToken, selected);
      onSaved(selected);
      onClose();
    } catch {
      Alert.alert("Error", "Failed to update your experience level. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>Experience level</Text>
      <Text style={styles.sheetSubtitle}>
        Sets how many new plants you'll explore at a time.
      </Text>

      {DIFFICULTY_OPTIONS.map(({ key, label, description }) => {
        const isSelected = selected === key;
        return (
          <Pressable
            key={key}
            style={[styles.levelRow, isSelected && styles.levelRowSelected]}
            onPress={() => setSelected(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.levelLabel, isSelected && styles.levelLabelSelected]}>
                {label}
              </Text>
              <Text style={styles.levelDescription}>{description}</Text>
            </View>
            {isSelected && <Ionicons name="checkmark-circle" size={22} color="#008080" />}
          </Pressable>
        );
      })}

      <Pressable
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
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
    </BottomSheet>
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
  const [showDifficulty, setShowDifficulty] = useState(false);

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
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => setShowDifficulty(true)}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.rowLabel}>Difficulty</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#008080" />
          ) : (
            <View style={styles.rowValueGroup}>
              <Text style={styles.rowValueInline} numberOfLines={1}>
                {profile?.difficulty_level
                  ? DIFFICULTY_LABELS[profile.difficulty_level] ?? profile.difficulty_level
                  : "—"}
              </Text>
              <Text style={styles.rowChevron}>›</Text>
            </View>
          )}
        </Pressable>
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
        <>
          <AllergiesSheet
            visible={showAllergies}
            onClose={() => setShowAllergies(false)}
            accessToken={token}
          />
          <DifficultySheet
            visible={showDifficulty}
            onClose={() => setShowDifficulty(false)}
            accessToken={token}
            current={profile?.difficulty_level ?? null}
            onSaved={(level) =>
              setProfile((prev) => (prev ? { ...prev, difficulty_level: level } : prev))
            }
          />
        </>
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
  rowValueInline: { fontSize: 16, color: "#888", flexShrink: 1 },
  rowValueGroup: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginLeft: 12,
  },
  rowChevron: { fontSize: 20, color: "#bbb" },

  // Difficulty level rows
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#eee",
    marginBottom: 10,
  },
  levelRowSelected: { borderColor: "#008080", backgroundColor: "#e6f4f4" },
  levelLabel: { fontSize: 16, fontWeight: "600", color: "#111" },
  levelLabelSelected: { color: "#008080" },
  levelDescription: { fontSize: 13, color: "#888", marginTop: 2 },
  guestWarningText: {
    fontSize: 13, color: "#888", lineHeight: 18,
    marginHorizontal: 20, marginTop: 8,
  },
  signOutRow: { justifyContent: "center" },
  signOutText: { fontSize: 16, color: "#c00", fontWeight: "500" },

  // Bottom sheet
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
