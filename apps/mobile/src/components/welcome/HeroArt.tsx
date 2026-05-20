import { Image, View } from "react-native";

import styles from "./welcomeStyles";

const smoothieHero = require("../../assets/welcome-smoothie.png");

export default function HeroArt() {
  return (
    <View style={styles.heroArt}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={smoothieHero}
        style={styles.heroImage}
      />
    </View>
  );
}
