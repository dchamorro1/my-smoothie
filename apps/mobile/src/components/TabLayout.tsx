import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import MyActiveIngredients from "../screens/MyActiveIngredients";
import StatsScreen from "../screens/StatsScreen";
import SettingsScreen from "../screens/SettingsScreen";

type Tab = "home" | "stats" | "settings";
type IconName = "home" | "stats-chart" | "settings";

type Props = {
  onSignOut: () => void;
  onLinkAccount: () => void;
};

export default function TabLayout({ onSignOut, onLinkAccount }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        {activeTab === "home" && <MyActiveIngredients />}
        {activeTab === "stats" && <StatsScreen />}
        {activeTab === "settings" && (
          <SettingsScreen onSignOut={onSignOut} onLinkAccount={onLinkAccount} />
        )}
      </View>

      <View style={styles.tabBar}>
        <TabItem
          icon="home"
          label="Home"
          active={activeTab === "home"}
          onPress={() => setActiveTab("home")}
        />
        <TabItem
          icon="stats-chart"
          label="Stats"
          active={activeTab === "stats"}
          onPress={() => setActiveTab("stats")}
        />
        <TabItem
          icon="settings"
          label="Settings"
          active={activeTab === "settings"}
          onPress={() => setActiveTab("settings")}
        />
      </View>
      <View style={[styles.safeAreaFill, { height: insets.bottom }]} />
    </View>
  );
}

type TabItemProps = {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
};

function TabItem({ icon, label, active, onPress }: TabItemProps) {
  const iconName = active ? icon : (`${icon}-outline` as `${IconName}-outline`);

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Ionicons name={iconName} size={24} color={active ? "#008080" : "#999"} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 3,
  },
  tabLabel: { fontSize: 11, color: "#999", fontWeight: "500" },
  tabLabelActive: { color: "#008080" },
  safeAreaFill: { backgroundColor: "#fff" },
});
