import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import BottomSheet from "../components/BottomSheet";
import { categoryEmoji } from "../utils/category";
import { supabase } from "../../utils/supabase";
import {
  CalendarStats,
  DayPlants,
  StreakStats,
  fetchCalendarStats,
  fetchDayPlants,
  fetchStreak,
} from "../services/api";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Heatmap palette (light → dark)
const EMPTY = "#ebedf0";
const LEVELS = ["#cdecd6", "#8fd6a6", "#3aa869", "#15703f"];

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Monday-start grid covering the whole month in full weeks
function buildMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(year, month, 1 - startOffset);

  const last = new Date(year, month + 1, 0);
  const endOffset = 6 - ((last.getDay() + 6) % 7);
  const gridEnd = new Date(year, month + 1, 0 + endOffset);

  const days: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function shadeColor(count: number, target: number): string {
  if (count <= 0) return EMPTY;
  const ratio = count / Math.max(target, 1);
  if (ratio < 0.5) return LEVELS[0];
  if (ratio < 1) return LEVELS[1];
  if (ratio < 2) return LEVELS[2];
  return LEVELS[3];
}

function isDarkShade(color: string): boolean {
  return color === LEVELS[2] || color === LEVELS[3];
}

// ── Animated flame ────────────────────────────────────────────────────────────

function Flame() {
  return (
    <LottieView
      // @ts-ignore
      source={require("../../assets/flame-streak.json")}
      autoPlay
      loop
      style={styles.flame}
    />
  );
}

function Leaf() {
  return (
    <LottieView
      // @ts-ignore
      source={require("../../assets/leaf.json")}
      autoPlay
      loop
      style={styles.leaf}
    />
  );
}

// ── Today pill ────────────────────────────────────────────────────────────────

function TodayPill({ onPress }: { onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.todayPill, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Jump to today"
      >
        <Text style={styles.todayPillText}>Today</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Shimmer placeholders ──────────────────────────────────────────────────────

function ShimmerGroup({ style, children }: { style?: any; children: React.ReactNode }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (w === 0) return;
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [w]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });

  return (
    <View style={[style, { overflow: "hidden" }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {children}
      {w > 0 && (
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

function StatCardSkeleton() {
  return (
    <ShimmerGroup style={styles.statCard}>
      <View style={styles.skelIcon} />
      <View style={{ flex: 1 }}>
        <View style={styles.skelValue} />
        <View style={styles.skelLabel} />
      </View>
    </ShimmerGroup>
  );
}

function CalendarGridSkeleton({ rows }: { rows: number }) {
  return (
    <ShimmerGroup style={styles.gridSkeleton}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.skelWeekRow}>
          {Array.from({ length: 7 }).map((_, c) => (
            <View key={c} style={styles.cellWrap}>
              <View style={styles.skelCell} />
            </View>
          ))}
        </View>
      ))}
    </ShimmerGroup>
  );
}

// ── Day detail sheet ──────────────────────────────────────────────────────────

function DayDetailSheet({ day, onClose }: { day: Date | null; onClose: () => void }) {
  const [data, setData] = useState<DayPlants | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return;
        const startISO = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0).toISOString();
        const endISO = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59).toISOString();
        const result = await fetchDayPlants(session.session.access_token, startISO, endISO);
        if (!cancelled) setData(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [day]);

  const dateLabel = day
    ? day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <BottomSheet visible={day !== null} onClose={onClose}>
      <Text style={styles.dayTitle}>{dateLabel}</Text>
      {data && data.total_plants > 0 && (
        <Text style={styles.daySubtitle}>
          {data.total_plants} {data.total_plants === 1 ? "plant" : "plants"}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator color="#008080" style={{ marginVertical: 28 }} />
      ) : !data || data.total_plants === 0 ? (
        <Text style={styles.dayEmpty}>No plant based foods eaten on this day 🌱</Text>
      ) : (
        <ScrollView style={{ maxHeight: 360 }} scrollEnabled>
          {data.plants.map((p) => (
            <View key={p.common_name} style={styles.dayRow}>
              <Text style={styles.dayPlantName}>{categoryEmoji(p.category)}  {p.common_name}</Text>
              <View style={styles.dayFiberBadge}>
                <Text style={styles.dayFiberText}>{p.fiber_quantity}g fiber / oz</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

export default function StatsScreen() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [stats, setStats] = useState<CalendarStats | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [monthLoading, setMonthLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [streak, setStreak] = useState<StreakStats | null>(null);
  const [streakLoading, setStreakLoading] = useState(true);

  const grid = buildMonthGrid(month);
  const todayKey = localDateKey(new Date());

  // Month-dependent data: calendar heatmap + unique-this-month.
  const loadMonth = async () => {
    setMonthLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const token = data.session.access_token;

      const gridStart = grid[0];
      const gridEnd = grid[grid.length - 1];
      const startISO = new Date(
        gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate(), 0, 0, 0
      ).toISOString();
      const endISO = new Date(
        gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate(), 23, 59, 59
      ).toISOString();

      // True month bounds (1st → last day) for the unique-this-month count
      const monthStartISO = new Date(
        month.getFullYear(), month.getMonth(), 1, 0, 0, 0
      ).toISOString();
      const monthEndISO = new Date(
        month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59
      ).toISOString();

      const result = await fetchCalendarStats(token, startISO, endISO, monthStartISO, monthEndISO);
      const bucket: Record<string, number> = {};
      for (const iso of result.events) {
        const key = localDateKey(new Date(iso));
        bucket[key] = (bucket[key] || 0) + 1;
      }
      setStats(result);
      setCounts(bucket);
    } finally {
      setMonthLoading(false);
    }
  };

  // Streak is month-independent.
  const loadStreak = async () => {
    setStreakLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const tzOffset = -new Date().getTimezoneOffset();
      const result = await fetchStreak(data.session.access_token, tzOffset);
      setStreak(result);
    } finally {
      setStreakLoading(false);
    }
  };

  // Reload the calendar/unique count whenever the viewed month changes.
  useEffect(() => { loadMonth(); }, [month]);
  // Streak loads once on mount.
  useEffect(() => { loadStreak(); }, []);

  const handleRefresh = () => {
    loadMonth();
    loadStreak();
  };

  const target = stats?.target ?? 1;
  const goal = stats?.goal ?? 0;

  // Chunk grid into Mon–Sun weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7));

  const changeMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const now = new Date();
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const goToToday = () => setMonth(new Date(now.getFullYear(), now.getMonth(), 1));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor="#008080" />
        }
      >
      <View style={styles.calendarCard}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <Text style={styles.monthLabel}>
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </Text>
          <View style={styles.navControls}>
            {!isCurrentMonth && <TodayPill onPress={goToToday} />}
            <Pressable onPress={() => changeMonth(-1)} style={styles.navButton} accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={22} color="#008080" />
            </Pressable>
            <Pressable onPress={() => changeMonth(1)} style={styles.navButton} accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={22} color="#008080" />
            </Pressable>
          </View>
        </View>

        {/* Weekday labels */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={styles.weekdayLabel}>{d}</Text>
          ))}
        </View>

        {monthLoading ? (
          <CalendarGridSkeleton rows={weeks.length} />
        ) : (
          weeks.map((week, wi) => {
            const weekSum = week.reduce((sum, d) => sum + (counts[localDateKey(d)] || 0), 0);
            const goalReached = goal > 0 && weekSum >= goal;
            return (
              <View
                key={wi}
                style={[styles.weekRow, goalReached && styles.weekRowReached]}
              >
                {week.map((d) => {
                  const key = localDateKey(d);
                  const count = counts[key] || 0;
                  const inMonth = d.getMonth() === month.getMonth();
                  const color = shadeColor(count, target);
                  const isToday = key === todayKey;
                  return (
                    <Pressable
                      key={key}
                      style={styles.cellWrap}
                      onPress={() => setSelectedDay(d)}
                      accessibilityRole="button"
                      accessibilityLabel={`${d.toDateString()}, ${count} plants`}
                    >
                      <View style={[styles.cell, { backgroundColor: color }]}>
                        {isToday && (
                          <View style={styles.todayCircleWrap} pointerEvents="none">
                            <View style={styles.todayCircle} />
                          </View>
                        )}
                        <Text
                          style={[
                            styles.cellText,
                            { color: isToday ? "#fff" : isDarkShade(color) ? "#fff" : "#444" },
                            isToday && styles.cellTextToday,
                            !inMonth && styles.cellTextFaded,
                          ]}
                        >
                          {d.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                {goalReached && (
                  <View style={styles.weekBadge}>
                    <Ionicons name="star" size={12} color="#fff" />
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendText}>Less</Text>
          <View style={[styles.legendSwatch, { backgroundColor: EMPTY }]} />
          {LEVELS.map((c) => (
            <View key={c} style={[styles.legendSwatch, { backgroundColor: c }]} />
          ))}
          <Text style={styles.legendText}>More</Text>
        </View>
      </View>

      {/* Unique plants this month */}
      {monthLoading ? (
        <StatCardSkeleton />
      ) : (
        <View style={styles.statCard}>
          <Leaf />
          <View style={{ flex: 1 }}>
            <Text style={styles.statValue}>{stats?.unique_this_month ?? 0}</Text>
            <Text style={styles.statLabel}>
              different plants in {MONTHS[month.getMonth()]}
            </Text>
          </View>
        </View>
      )}

      {/* Daily streak */}
      {streakLoading ? (
        <StatCardSkeleton />
      ) : (
        <View style={[styles.statCard, styles.streakCard]}>
          <Flame />
          <View style={{ flex: 1 }}>
            <Text style={styles.statValue}>
              {streak?.streak ?? 0} {streak?.streak === 1 ? "day" : "days"}
            </Text>
            <Text style={styles.statLabel}>
              streak hitting your daily goal of {streak?.target ?? 0}
            </Text>
          </View>
        </View>
      )}
      </ScrollView>

      <DayDetailSheet day={selectedDay} onClose={() => setSelectedDay(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f2f7" },
  scrollContent: { paddingBottom: 24 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 34, fontWeight: "700", color: "#111" },

  // Stat cards
  statCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  streakCard: { backgroundColor: "#fff7ed" },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e6f4f4",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 24, fontWeight: "800", color: "#111" },
  statLabel: { fontSize: 13, color: "#777", marginTop: 1 },
  flame: { width: 48, height: 48 },
  leaf: { width: 48, height: 48 },

  // Shimmer skeletons
  skelIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#e5e7eb" },
  skelValue: { width: 56, height: 20, borderRadius: 6, backgroundColor: "#e5e7eb" },
  skelLabel: { width: "70%", height: 12, borderRadius: 6, backgroundColor: "#e5e7eb", marginTop: 8 },
  gridSkeleton: {},
  skelWeekRow: { flexDirection: "row", marginVertical: 3 },
  skelCell: { aspectRatio: 1, borderRadius: 8, backgroundColor: "#e5e7eb" },

  calendarCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  navButton: { padding: 6 },
  navControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  monthLabel: { fontSize: 17, fontWeight: "700", color: "#111" },
  todayPill: {
    backgroundColor: "#e6f4f4",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginRight: 2,
  },
  todayPillText: { fontSize: 13, fontWeight: "700", color: "#008080" },
  weekdayRow: { flexDirection: "row", marginBottom: 6 },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  weekRow: {
    flexDirection: "row",
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 12,
    marginVertical: 3,
  },
  weekRowReached: {
    borderColor: "#fde9b8",
    backgroundColor: "#fff8e6",
    // soft gold glow
    shadowColor: "#f5b301",
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  weekBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f5b301",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  cellWrap: { flex: 1, padding: 2 },
  cell: {
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCircleWrap: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCircle: {
    width: "68%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "#ff5a3c",
  },
  cellText: { fontSize: 12, fontWeight: "600" },
  cellTextToday: { fontWeight: "800" },
  cellTextFaded: { opacity: 0.35 },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 14,
  },
  legendText: { fontSize: 11, color: "#999", marginHorizontal: 4 },
  legendSwatch: { width: 14, height: 14, borderRadius: 3 },

  // Day detail sheet
  dayTitle: { fontSize: 20, fontWeight: "700", color: "#111" },
  daySubtitle: { fontSize: 14, color: "#008080", fontWeight: "600", marginTop: 2, marginBottom: 12 },
  dayEmpty: { fontSize: 15, color: "#888", textAlign: "center", marginVertical: 28 },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  dayPlantName: { fontSize: 16, color: "#111", fontWeight: "500" },
  dayFiberBadge: {
    backgroundColor: "#e6f4f4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  dayFiberText: { fontSize: 12, color: "#008080", fontWeight: "600" },
});
