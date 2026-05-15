import { Text, View } from "react-native";

import { Leaf } from "./FruitShapes";
import styles from "./welcomeStyles";
console.log("BrandLogo rendered");
export default function BrandLogo() {
  return (
    <View style={styles.logoBlock}>
      <Text style={styles.logoMy}>My</Text>
      <View style={styles.smoothieLine}>
        <Text style={styles.logoSmoothie}>Smoothie</Text>
        <View style={styles.logoLeaves}>
          <Leaf style={styles.logoLeafSmall} />
          <Leaf style={styles.logoLeafLarge} />
        </View>
      </View>
    </View>
  );
}
