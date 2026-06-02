import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../components/BottomSheet";
import { supabase } from "../../utils/supabase";
import { CalendarStats, DayPlants, fetchCalendarStats, fetchDayPlants } from "../services/api";

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
              <Text style={styles.dayPlantName}>{p.common_name}</Text>
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
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const grid = buildMonthGrid(month);
  const todayKey = localDateKey(new Date());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;

        const gridStart = grid[0];
        const gridEnd = grid[grid.length - 1];
        const startISO = new Date(
          gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate(), 0, 0, 0
        ).toISOString();
        const endISO = new Date(
          gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate(), 23, 59, 59
        ).toISOString();

        const result = await fetchCalendarStats(data.session.access_token, startISO, endISO);
        if (cancelled) return;

        const bucket: Record<string, number> = {};
        for (const iso of result.events) {
          const key = localDateKey(new Date(iso));
          bucket[key] = (bucket[key] || 0) + 1;
        }
        setStats(result);
        setCounts(bucket);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [month]);

  const target = stats?.target ?? 1;
  const goal = stats?.goal ?? 0;

  // Chunk grid into Mon–Sun weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7));

  const changeMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
      </View>

      <View style={styles.calendarCard}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <Pressable onPress={() => changeMonth(-1)} style={styles.navButton} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={22} color="#008080" />
          </Pressable>
          <Text style={styles.monthLabel}>
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </Text>
          <Pressable onPress={() => changeMonth(1)} style={styles.navButton} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={22} color="#008080" />
          </Pressable>
        </View>

        {/* Weekday labels */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={styles.weekdayLabel}>{d}</Text>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#008080" style={{ marginVertical: 40 }} />
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
                      <View
                        style={[
                          styles.cell,
                          { backgroundColor: color },
                          isToday && styles.cellToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cellText,
                            { color: isDarkShade(color) ? "#fff" : "#444" },
                            !inMonth && styles.cellTextFaded,
                          ]}
                        >
                          {d.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
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

      <DayDetailSheet day={selectedDay} onClose={() => setSelectedDay(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f2f7" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 34, fontWeight: "700", color: "#111" },
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
  monthLabel: { fontSize: 17, fontWeight: "700", color: "#111" },
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
    marginVertical: 1,
  },
  weekRowReached: {
    borderColor: "#f5b301",
    backgroundColor: "#fffdf5",
  },
  cellWrap: { flex: 1, padding: 2 },
  cell: {
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cellToday: { borderWidth: 2, borderColor: "#008080" },
  cellText: { fontSize: 12, fontWeight: "600" },
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
