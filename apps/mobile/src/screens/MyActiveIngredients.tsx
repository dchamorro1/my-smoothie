import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase";
import { fetchUserActivePlants, ActivePlant } from "../services/auth";

export default function MyActiveIngredients() {
  const [plants, setPlants] = useState<ActivePlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    loadPlants();
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Active Plants</Text>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#008080" />
          <Text style={styles.loadingText}>Finding your plants...</Text>
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
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.plantName}>{item.common_name}</Text>
              <View style={styles.fiberBadge}>
                <Text style={styles.fiberText}>{item.fiber_quantity}g fiber / oz</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9f9" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, color: "#555", fontSize: 15 },
  errorText: { color: "#c00", fontSize: 15, textAlign: "center" },
  emptyText: { color: "#777", fontSize: 15, textAlign: "center" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  plantName: { fontSize: 17, fontWeight: "600", color: "#111" },
  fiberBadge: {
    backgroundColor: "#e6f4f4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  fiberText: { fontSize: 12, color: "#008080", fontWeight: "600" },
});
