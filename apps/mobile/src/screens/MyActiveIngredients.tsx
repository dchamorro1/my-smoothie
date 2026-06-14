import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
// @ts-ignore — legacy Swipeable, works without react-native-reanimated
import Swipeable from "react-native-gesture-handler/Swipeable";
import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomSheet from "../components/BottomSheet";
import { categoryEmoji } from "../utils/category";
import { supabase } from "../../utils/supabase";
import {
  ActivePlant,
  PlantSearchResult,
  WeeklyProgress,
  addCustomPlant,
  buyPlant,
  fetchUserActivePlants,
  fetchWeeklyProgress,
  getLocalWeekStart,
  removePlant,
  searchPlants,
  skipPlant,
} from "../services/api";

const CELEBRATED_WEEK_KEY = "celebratedWeek";

const HARD_SWIPE_THRESHOLD = -220;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ consumed, goal }: { consumed: number; goal: number }) {
  const isOverGoal = consumed >= goal;
  const pct = Math.min(consumed / goal, 1);

  const [trackWidth, setTrackWidth] = useState(0);
  const fillWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trackWidth === 0) return;
    const target = (isOverGoal ? 1 : pct) * trackWidth;
    Animated.timing(fillWidth, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, trackWidth, isOverGoal]);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>
          {isOverGoal ? "✨ " : ""}
          <Text style={styles.progressCount}>{consumed}</Text>
          {" / "}
          <Text style={styles.progressCount}>{goal}</Text>
          {"  unique plants consumed this week"}
          {isOverGoal ? " ✨" : ""}
        </Text>
      </View>
      <View
        style={styles.progressTrack}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.progressFill, { width: fillWidth }]}>
          {isOverGoal && (
            <LinearGradient
              colors={["#f59e0b", "#ef4444", "#8b5cf6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressGradientFill}
            />
          )}
        </Animated.View>
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

// ── Add-your-own search sheet ─────────────────────────────────────────────────

type AddPlantSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAdded: (plant: ActivePlant) => void;
};

function AddPlantSheet({ visible, onClose, onAdded }: AddPlantSheetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlantSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setQuery("");
      setResults([]);
    }
  }, [visible]);

  // Debounced search whenever the query changes (while open)
  useEffect(() => {
    if (!visible) return;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const token = await getToken();
        if (token) setResults(await searchPlants(token, query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, visible]);

  const handleAdd = async (plant: PlantSearchResult) => {
    setAddingId(plant.id);
    try {
      const token = await getToken();
      if (token) {
        const added = await addCustomPlant(token, plant.id);
        onAdded(added);
        onClose();
      }
    } catch {
      // Surface the failure inline by clearing the spinner; row stays tappable
    } finally {
      setAddingId(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>Add your own</Text>
      <Text style={styles.sheetSubtitle}>Search for a plant you already have.</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search plants…"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </View>

      <View style={styles.resultsArea}>
        {searching && results.length === 0 ? (
          <ActivityIndicator color="#008080" style={{ marginVertical: 20 }} />
        ) : results.length === 0 ? (
          <Text style={styles.noResults}>No matches available.</Text>
        ) : (
          results.map((plant) => (
            <Pressable
              key={plant.id}
              style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
              onPress={() => handleAdd(plant)}
              disabled={addingId !== null}
              accessibilityRole="button"
            >
              <Text style={styles.resultName}>{categoryEmoji(plant.category)}  {plant.common_name}</Text>
              {addingId === plant.id ? (
                <ActivityIndicator size="small" color="#008080" />
              ) : (
                <View style={styles.resultFiberBadge}>
                  <Text style={styles.resultFiberText}>{plant.fiber_quantity}g fiber / oz</Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </View>
    </BottomSheet>
  );
}

// ── Loading shimmer ───────────────────────────────────────────────────────────

function ShimmerCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View
      style={[styles.card, styles.skeletonCard]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonBadge} />

      {width > 0 && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.65)", "transparent"]}
            locations={[0.35, 0.5, 0.65]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

function LoadingShimmer() {
  // Rendered inside the FlatList content container (which already has list
  // padding), so only add the inter-card gap here.
  return (
    <View style={{ gap: 12 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <ShimmerCard key={i} />
      ))}
    </View>
  );
}

// ── Plant row ────────────────────────────────────────────────────────────────

type PlantRowProps = {
  item: ActivePlant;
  index: number;
  onBuy: (id: number) => void;
  onRemove: (id: number, reason: "consumed" | "discarded") => void;
  onSkip: (id: number) => void;
};

const STAGGER_MS = 70;

function PlantRow({ item, index, onBuy, onRemove, onSkip }: PlantRowProps) {
  const swipeRef = useRef<Swipeable>(null);
  const autoSkipFired = useRef(false);
  const dragXRef = useRef<Animated.Value | null>(null);
  const bought = item.status === "bought";

  // Staggered entrance animation
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      delay: index * STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    return () => { dragXRef.current?.removeAllListeners(); };
  }, []);

  const animatedStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

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
    <Animated.View style={animatedStyle}>
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
          <Text style={styles.plantName}>{categoryEmoji(item.category)}  {item.common_name}</Text>
          <View style={styles.fiberBadge}>
            <Text style={styles.fiberText}>{item.fiber_quantity}g fiber / oz</Text>
          </View>
        </View>
      </Swipeable>
    </Animated.View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MyActiveIngredients() {
  const insets = useSafeAreaInsets();
  const [plants, setPlants] = useState<ActivePlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<WeeklyProgress | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);

  useEffect(() => {
    loadPlants();
    loadProgress();
  }, []);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const loadPlants = async () => {
    setLoading(true);
    setError(null);
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

  const handleRefresh = () => {
    loadPlants();
    loadProgress();
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
    setProgress(next);
    maybeCelebrate(next);
  };

  // Celebrate once per week, the first time the goal is reached. Persisted in
  // AsyncStorage (keyed by the local week start) so it survives tab remounts and
  // app restarts, but fires again the following week.
  const maybeCelebrate = async (p: WeeklyProgress) => {
    if (p.goal <= 0 || p.consumed < p.goal) return;
    const weekStart = getLocalWeekStart();
    const celebrated = await AsyncStorage.getItem(CELEBRATED_WEEK_KEY);
    if (celebrated === weekStart) return;
    await AsyncStorage.setItem(CELEBRATED_WEEK_KEY, weekStart);
    setShowCelebration(true);
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
    <View style={styles.screen}>
      <LinearGradient
        colors={["#0f766e", "#14b8a6", "#34d399"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.greeting}>{getGreeting()} 🌱</Text>
        <Text style={styles.title}>My Weekly Ingredients</Text>

        {progress && (
          <ProgressBar consumed={progress.consumed} goal={progress.goal} />
        )}
      </LinearGradient>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={loading ? [] : plants}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor="#008080" />
          }
          renderItem={({ item, index }) =>
            skippedIds.has(item.id) ? (
              <SkippedPlaceholder key={item.id} />
            ) : (
              <PlantRow
                item={item}
                index={index}
                onBuy={handleBuy}
                onRemove={handleRemove}
                onSkip={handleSkip}
              />
            )
          }
          ListEmptyComponent={
            loading ? (
              <LoadingShimmer />
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>You've eaten all your plants this week! 🌱</Text>
                <Text style={styles.emptySubtitle}>
                  Nice work. Want more? Add your own below.
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            loading ? null : (
              <Pressable
                style={({ pressed }) => [styles.addRow, pressed && styles.addRowPressed]}
                onPress={() => setShowAddSheet(true)}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle-outline" size={22} color="#008080" />
                <Text style={styles.addRowText}>Add your own</Text>
              </Pressable>
            )
          }
        />
      )}

      <CelebrationModal
        visible={showCelebration}
        goal={progress?.goal ?? 0}
        onClose={() => setShowCelebration(false)}
      />

      <AddPlantSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onAdded={appendNewPlant}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9f9" },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#0f766e",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  greeting: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 2,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },

  // Progress bar
  progressContainer: {
    marginTop: 18,
  },
  progressLabelRow: { marginBottom: 8 },
  progressLabel: { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  progressCount: { fontWeight: "800", color: "#fff" },
  progressTrack: {
    height: 9,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  progressGradientFill: {
    flex: 1,
    borderRadius: 999,
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
  errorText: { color: "#c00", fontSize: 15, textAlign: "center" },
  emptyText: { color: "#777", fontSize: 15, textAlign: "center" },
  emptyWrap: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#111", textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: "#777", textAlign: "center", marginTop: 6 },
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
  skeletonCard: { backgroundColor: "#fff", overflow: "hidden" },
  skeletonCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#e5e7eb" },
  skeletonLine: { flex: 1, height: 16, borderRadius: 6, backgroundColor: "#e5e7eb" },
  skeletonBadge: { width: 84, height: 24, borderRadius: 20, backgroundColor: "#e5e7eb" },
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

  // Add-your-own footer row
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#cce7e7",
    borderStyle: "dashed",
    marginTop: 4,
  },
  addRowPressed: { backgroundColor: "#e6f4f4" },
  addRowText: { fontSize: 16, fontWeight: "600", color: "#008080" },

  // Add-your-own sheet
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, color: "#888", marginBottom: 16 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f2f2f7",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 16, color: "#111" },
  resultsArea: { marginTop: 12, minHeight: 120 },
  noResults: { textAlign: "center", color: "#999", fontSize: 14, marginVertical: 24 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  resultRowPressed: { backgroundColor: "#f7f7f7" },
  resultName: { fontSize: 16, color: "#111", fontWeight: "500" },
  resultFiberBadge: {
    backgroundColor: "#e6f4f4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  resultFiberText: { fontSize: 12, color: "#008080", fontWeight: "600" },
});
