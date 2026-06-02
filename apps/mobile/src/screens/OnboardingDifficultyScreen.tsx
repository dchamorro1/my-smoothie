import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LEVELS = [
  { key: "beginner", label: "Beginner", description: "2 new plants at a time" },
  { key: "intermediate", label: "Intermediate", description: "3 new plants at a time" },
  { key: "advanced", label: "Advanced", description: "4 new plants at a time" },
  { key: "expert", label: "Expert", description: "5 new plants at a time" },
];

type Props = {
  onBack: () => void;
  onContinue: (difficulty: string) => void;
};

export default function OnboardingDifficultyScreen({ onBack, onContinue }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable style={styles.backButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>How adventurous are you?</Text>
        <Text style={styles.subtitle}>
          Choose how many new plants you'd like to explore at a time.
        </Text>

        <View style={styles.options}>
          {LEVELS.map((level) => {
            const isSelected = selected === level.key;
            return (
              <Pressable
                key={level.key}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => setSelected(level.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {level.label}
                </Text>
                <Text style={[styles.optionDescription, isSelected && styles.optionDescriptionSelected]}>
                  {level.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.button, !selected && styles.buttonDisabled]}
          onPress={() => selected && onContinue(selected)}
          disabled={!selected}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Continue</Text>
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
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
  },
  optionSelected: { borderColor: "#008080", backgroundColor: "#e6f4f4" },
  optionLabel: { fontSize: 17, fontWeight: "600", color: "#111" },
  optionLabelSelected: { color: "#008080" },
  optionDescription: { fontSize: 13, color: "#777", marginTop: 2 },
  optionDescriptionSelected: { color: "#008080" },
  button: {
    backgroundColor: "#008080",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#aaa" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
