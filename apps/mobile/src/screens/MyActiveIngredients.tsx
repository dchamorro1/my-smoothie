import { View, Text, Pressable, StyleSheet } from "react-native";
import { supabase } from "../../utils/supabase";

type Props = {
  onSignOut: () => void;
};

export default function MyActiveIngredients({ onSignOut }: Props) {
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign-out failed:", error.message);
    }
    onSignOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Active Ingredients</Text>
      <Text style={styles.subtitle}>
        Your guest account is active and ready to use.
      </Text>
      <Pressable style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#444",
    marginBottom: 24,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#008080",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
