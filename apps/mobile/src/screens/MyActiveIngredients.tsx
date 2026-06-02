import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
// @ts-ignore — legacy Swipeable, works without react-native-reanimated
import Swipeable from "react-native-gesture-handler/Swipeable";
import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../utils/supabase";
import {
  ActivePlant,
  WeeklyProgress,
  buyPlant,
  fetchUserActivePlants,
  fetchWeeklyProgress,
  removePlant,
  skipPlant,
} from "../services/auth";

const HARD_SWIPE_THRESHOLD = -220;

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ consumed, goal }: { consumed: number; goal: number }) {
  const isOverGoal = consumed >= goal;
  const pct = Math.min(consumed / goal, 1);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>
          {isOverGoal ? "✨ " : ""}
          <Text style={styles.progressCount}>{consumed}</Text>
          {" / "}
          <Text style={styles.progressCount}>{goal}</Text>
          {"  plants consumed this week"}
          {isOverGoal ? " ✨" : ""}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        {isOverGoal ? (
          <LinearGradient
            colors={["#f59e0b", "#ef4444", "#8b5cf6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressFill}
          />
        ) : (
          <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
        )}
      </View>
    </View>
  );
}

// ── Celebration modal ────────────────────────────────────────────────────────

function CelebrationModal({ visible, goal, onClose }: { visible: boolean; goal: number; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.celebrationOverlay}>
        <View style={styles.celebrationCard}>
          {/* Place a Lottie rabbit animation at apps/mobile/assets/rabbit-celebrate.json
              Download one from https://lottiefiles.com/search?q=rabbit+eating+carrot */}
          <LottieView
            // @ts-ignore
            source={require("../../assets/rabbit-celebrate.json")}
            autoPlay
            loop={false}
            style={styles.lottie}
          />
          <Text style={styles.celebrationTitle}>Weekly goal reached! 🎉</Text>
          <Text style={styles.celebrationSubtitle}>
            You've consumed {goal} plants this week. That's incredible!
          </Text>
          <Pressable
            style={({ pressed }) => [styles.celebrationButton, pressed && { opacity: 0.85 }]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.celebrationButtonText}>Keep going 🐇</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Skipped placeholder ──────────────────────────────────────────────────────

function SkippedPlaceholder() {
  return (
    <View style={styles.skippedPlaceholder}>
      <Ionicons name="checkmark-circle" size={20} color="#60a5fa" />
      <Text style={styles.skippedText}>Skipped</Text>
    </View>
  );
}

// ── Plant row ────────────────────────────────────────────────────────────────

type PlantRowProps = {
  item: ActivePlant;
  onBuy: (id: number) => void;
  onRemove: (id: number, reason: "consumed" | "discarded") => void;
  onSkip: (id: number) => void;
};

function PlantRow({ item, onBuy, onRemove, onSkip }: PlantRowProps) {
  const swipeRef = useRef<Swipeable>(null);
  const autoSkipFired = useRef(false);
  const dragXRef = useRef<Animated.Value | null>(null);
  const bought = item.status === "bought";

  useEffect(() => {
    return () => { dragXRef.current?.removeAllListeners(); };
  }, []);

  const handleSkip = () => {
    swipeRef.current?.close();
    onSkip(item.id);
  };

  const handleRemove = (reason: "consumed" | "discarded") => {
    swipeRef.current?.close();
    onRemove(item.id, reason);
  };

  const pendingRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!dragXRef.current) {
      dragXRef.current = dragX as unknown as Animated.Value;
      dragXRef.current.addListener(({ value }) => {
        if (value < HARD_SWIPE_THRESHOLD && !autoSkipFired.current) {
          autoSkipFired.current = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onSkip(item.id);
        }
      });
    }
    return (
      <Pressable
        style={styles.skipAction}
        onPress={handleSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip this plant"
      >
        <Ionicons name="play-skip-forward" size={20} color="#fff" />
        <Text style={styles.swipeActionText}>Skip</Text>
      </Pressable>
    );
  };

  const boughtRightActions = () => (
    <View style={styles.swipeActions}>
      <Pressable
        style={[styles.swipeAction, styles.consumedAction]}
        onPress={() => handleRemove("consumed")}
        accessibilityRole="button"
        accessibilityLabel="Mark as consumed"
      >
        <Ionicons name="checkmark-done" size={20} color="#fff" />
        <Text style={styles.swipeActionText}>Consumed</Text>
      </Pressable>
      <Pressable
        style={[styles.swipeAction, styles.discardAction]}
        onPress={() => handleRemove("discarded")}
        accessibilityRole="button"
        accessibilityLabel="Discard item"
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={styles.swipeActionText}>Discard</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={bought ? boughtRightActions : pendingRightActions}
      overshootFriction={4}
      onSwipeableClose={() => { autoSkipFired.current = false; }}
    >
      <View style={[styles.card, bought ? styles.cardBought : styles.cardPending]}>
        <Pressable
          onPress={() => !bought && onBuy(item.id)}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={bought ? "Added to pantry" : `Add ${item.common_name} to pantry`}
        >
          <Ionicons
            name={bought ? "checkmark-circle" : "add-circle-outline"}
            size={28}
            color={bought ? "#008080" : "#f59e0b"}
          />
        </Pressable>
        <Text style={styles.plantName}>{item.common_name}</Text>
        <View style={styles.fiberBadge}>
          <Text style={styles.fiberText}>{item.fiber_quantity}g fiber / oz</Text>
        </View>
      </View>
    </Swipeable>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MyActiveIngredients() {
  const [plants, setPlants] = useState<ActivePlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<WeeklyProgress | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  // Tracks whether the celebration has already fired this session
  const celebrationFiredRef = useRef(false);

  useEffect(() => {
    loadPlants();
    loadProgress();
  }, []);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const loadPlants = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("No active session.");
      const result = await fetchUserActivePlants(data.session.access_token);
      setPlants(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plants.");
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const result = await fetchWeeklyProgress(token);
      updateProgress(result);
    } catch {
      // Non-critical — fail silently
    }
  };

  const updateProgress = (next: WeeklyProgress) => {
    setProgress((prev) => {
      const wasBelow = !prev || prev.consumed < next.goal;
      if (wasBelow && next.consumed >= next.goal && !celebrationFiredRef.current) {
        celebrationFiredRef.current = true;
        setShowCelebration(true);
      }
      return next;
    });
  };

  const appendNewPlant = (newPlant: ActivePlant | null) => {
    if (!newPlant) return;
    setPlants((prev) =>
      [...prev, newPlant].sort((a, b) => {
        if (a.status === b.status) return a.position_index - b.position_index;
        return a.status === "bought" ? -1 : 1;
      })
    );
  };

  const handleBuy = async (plantId: number) => {
    setPlants((prev) => {
      const updated = prev.map((p) =>
        p.id === plantId ? { ...p, status: "bought" as const } : p
      );
      return [...updated].sort((a, b) => {
        if (a.status === b.status) return a.position_index - b.position_index;
        return a.status === "bought" ? -1 : 1;
      });
    });
    try {
      const token = await getToken();
      if (token) await buyPlant(token, plantId);
    } catch {
      const token = await getToken();
      if (token) setPlants(await fetchUserActivePlants(token));
    }
  };

  const handleSkip = async (plantId: number) => {
    setSkippedIds((prev) => new Set(prev).add(plantId));
    setTimeout(() => {
      setSkippedIds((prev) => { const s = new Set(prev); s.delete(plantId); return s; });
      setPlants((prev) => prev.filter((p) => p.id !== plantId));
    }, 800);
    try {
      const token = await getToken();
      if (token) {
        const newPlant = await skipPlant(token, plantId);
        setTimeout(() => appendNewPlant(newPlant), 800);
      }
    } catch {
      setTimeout(async () => {
        const token = await getToken();
        if (token) setPlants(await fetchUserActivePlants(token));
      }, 800);
    }
  };

  const handleRemove = async (plantId: number, reason: "consumed" | "discarded") => {
    // Optimistically increment progress if consuming
    if (reason === "consumed" && progress) {
      updateProgress({ ...progress, consumed: progress.consumed + 1 });
    }
    setPlants((prev) => prev.filter((p) => p.id !== plantId));
    try {
      const token = await getToken();
      if (token) {
        const newPlant = await removePlant(token, plantId, reason);
        appendNewPlant(newPlant);
      }
    } catch {
      const token = await getToken();
      if (token) {
        setPlants(await fetchUserActivePlants(token));
        loadProgress();
      }
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Daily Ingredients</Text>
      </View>

      {progress && (
        <ProgressBar consumed={progress.consumed} goal={progress.goal} />
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#008080" />
          <Text style={styles.loadingText}>Finding your ingredients...</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && plants.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No plants available for this season.</Text>
        </View>
      )}

      {!loading && !error && plants.length > 0 && (
        <FlatList
          data={plants}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            skippedIds.has(item.id) ? (
              <SkippedPlaceholder key={item.id} />
            ) : (
              <PlantRow
                item={item}
                onBuy={handleBuy}
                onRemove={handleRemove}
                onSkip={handleSkip}
              />
            )
          }
        />
      )}

      <CelebrationModal
        visible={showCelebration}
        goal={progress?.goal ?? 0}
        onClose={() => setShowCelebration(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9f9" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111" },

  // Progress bar
  progressContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  progressLabelRow: { marginBottom: 6 },
  progressLabel: { fontSize: 13, color: "#555" },
  progressCount: { fontWeight: "700", color: "#111" },
  progressTrack: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#008080",
  },

  // Celebration modal
  celebrationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  celebrationCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  lottie: { width: 200, height: 200 },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    marginTop: 8,
    textAlign: "center",
  },
  celebrationSubtitle: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
  },
  celebrationButton: {
    backgroundColor: "#008080",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  celebrationButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // List
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, color: "#555", fontSize: 15 },
  errorText: { color: "#c00", fontSize: 15, textAlign: "center" },
  emptyText: { color: "#777", fontSize: 15, textAlign: "center" },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardBought: { backgroundColor: "#fff" },
  cardPending: { backgroundColor: "#fffbeb" },
  iconButton: { padding: 2 },
  plantName: { flex: 1, fontSize: 17, fontWeight: "600", color: "#111" },
  fiberBadge: {
    backgroundColor: "#e6f4f4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  fiberText: { fontSize: 12, color: "#008080", fontWeight: "600" },
  skippedPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  skippedText: { fontSize: 15, fontWeight: "600", color: "#3b82f6" },
  skipAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 14,
    gap: 4,
    backgroundColor: "#3b82f6",
    marginLeft: 8,
  },
  swipeActions: { flexDirection: "row", marginLeft: 8 },
  swipeAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 14,
    gap: 4,
  },
  consumedAction: { backgroundColor: "#4caf50" },
  discardAction: { backgroundColor: "#ef5350" },
  swipeActionText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
