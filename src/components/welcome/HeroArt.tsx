import { View } from "react-native";

import {
  Banana,
  Blueberry,
  Dot,
  Kiwi,
  Leaf,
  OrangeSlice,
  Raspberry,
  Strawberry,
} from "./FruitShapes";
import SmoothieCup from "./SmoothieCup";
import styles from "./welcomeStyles";

export default function HeroArt() {
  return (
    <View style={styles.heroArt}>
      <View style={styles.glowCircle} />
      <Banana />
      <View style={styles.strawberryPosition}>
        <Strawberry />
      </View>
      <View style={styles.raspberryPosition}>
        <Raspberry />
      </View>
      <View style={styles.kiwiPosition}>
        <Kiwi />
      </View>
      <View style={styles.orangePosition}>
        <OrangeSlice />
      </View>
      <Blueberry style={styles.blueberryOne} />
      <Blueberry style={styles.blueberryTwo} />
      <Blueberry style={styles.blueberryThree} />
      <Leaf style={styles.leafOne} />
      <Leaf style={styles.leafTwo} />
      <Leaf style={styles.leafThree} />
      <Leaf style={styles.leafFour} />
      <Dot color="#ffc7c8" size={12} style={styles.dotOne} />
      <Dot color="#fac1ca" size={9} style={styles.dotTwo} />
      <Dot color="#ffc758" size={13} style={styles.dotThree} />
      <Dot color="#8ec2cf" size={18} style={styles.dotFour} />
      <Dot color="#c7dd73" size={10} style={styles.dotFive} />
      <SmoothieCup />
    </View>
  );
}
