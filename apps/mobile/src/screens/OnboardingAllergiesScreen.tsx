import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ALLERGENS = [
  { key: "tree_nuts", label: "Tree Nuts" },
  { key: "peanuts", label: "Peanuts" },
  { key: "wheat", label: "Wheat" },
  { key: "soybeans", label: "Soybeans" },
  { key: "sesame", label: "Sesame" },
];

type Props = {
  onBack: () => void;
  onContinue: (allergies: string[]) => Promise<void>;
};

export default function OnboardingAllergiesScreen({ onBack, onContinue }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noneSelected, setNoneSelected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAllergen = (key: string) => {
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

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      await onContinue(noneSelected ? [] : Array.from(selected));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable style={styles.backButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>Any food allergies?</Text>
        <Text style={styles.subtitle}>
          We'll never recommend a plant that could cause a reaction.
        </Text>

        <View style={styles.options}>
          {ALLERGENS.map((allergen) => {
            const isSelected = selected.has(allergen.key);
            return (
              <Pressable
                key={allergen.key}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggleAllergen(allergen.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {allergen.label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            style={[styles.option, noneSelected && styles.optionSelected]}
            onPress={toggleNone}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: noneSelected }}
          >
            <View style={[styles.checkbox, noneSelected && styles.checkboxSelected]}>
              {noneSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.optionLabel, noneSelected && styles.optionLabelSelected]}>
              None of the above
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Get Started</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  backButton: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  backText: { fontSize: 16, color: "#008080", fontWeight: "500" },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 8, color: "#111" },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 32 },
  options: { gap: 12, marginBottom: 40 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  optionSelected: { borderColor: "#008080", backgroundColor: "#e6f4f4" },
  optionLabel: { fontSize: 16, color: "#111", fontWeight: "500" },
  optionLabelSelected: { color: "#008080" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { borderColor: "#008080", backgroundColor: "#008080" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  button: {
    backgroundColor: "#008080",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#aaa" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c00", marginBottom: 16, textAlign: "center" },
});
