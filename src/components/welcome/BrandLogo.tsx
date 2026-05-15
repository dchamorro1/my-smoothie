import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Leaf } from "./FruitShapes";
import styles from "./welcomeStyles";

export default function BrandLogo() {
  const { t } = useTranslation();

  return (
    <View style={styles.logoBlock}>
      <Text style={styles.logoMy}>{t("brand.my")}</Text>
      <View style={styles.smoothieLine}>
        <Text style={styles.logoSmoothie}>{t("brand.smoothie")}</Text>
        <View style={styles.logoLeaves}>
          <Leaf style={styles.logoLeafSmall} />
          <Leaf style={styles.logoLeafLarge} />
        </View>
      </View>
    </View>
  );
}
