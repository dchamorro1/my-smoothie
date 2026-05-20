import { Image, StyleProp, View, ViewStyle } from "react-native";

import styles from "./welcomeStyles";

const smoothieHero = require("../../assets/welcome-smoothie.png");

type Props = {
  style?: StyleProp<ViewStyle>;
};

export default function HeroArt({ style }: Props) {
  return (
    <View style={[styles.heroArt, style]}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={smoothieHero}
        style={styles.heroImage}
      />
    </View>
  );
}
