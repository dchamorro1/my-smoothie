import { View } from "react-native";

import styles from "./welcomeStyles";

export default function SmoothieCup() {
  return (
    <View style={styles.cupShadowWrap}>
      <View style={styles.lidHandle} />
      <View style={styles.cupLid} />
      <View style={styles.cupBody}>
        <View style={styles.smoothieFill} />
        <View style={styles.cupHighlight} />
      </View>
      <View style={styles.cupBase} />
      <View style={styles.cupShadow} />
    </View>
  );
}
