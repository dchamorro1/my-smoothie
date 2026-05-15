import { StyleProp, View, ViewStyle } from "react-native";

import styles from "./welcomeStyles";

type PositionedStyle = StyleProp<ViewStyle>;

type DotProps = {
  color: string;
  size: number;
  style: PositionedStyle;
};

export function Dot({ color, size, style }: DotProps) {
  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
        style,
      ]}
    />
  );
}

export function Leaf({ style }: { style: PositionedStyle }) {
  return <View style={[styles.leaf, style]} />;
}

export function Blueberry({ style }: { style: PositionedStyle }) {
  return (
    <View style={[styles.blueberry, style]}>
      <View style={styles.blueberryBloom} />
      <View style={styles.blueberryShine} />
    </View>
  );
}

export function Strawberry() {
  return (
    <View style={styles.strawberryWrap}>
      <View style={styles.strawberryLeafRow}>
        <Leaf style={styles.strawberryLeafLeft} />
        <Leaf style={styles.strawberryLeafMiddle} />
        <Leaf style={styles.strawberryLeafRight} />
      </View>
      <View style={styles.strawberry}>
        {[
          [24, 24],
          [45, 33],
          [66, 24],
          [32, 54],
          [56, 63],
          [42, 84],
          [70, 91],
        ].map(([left, top]) => (
          <View key={`${left}-${top}`} style={[styles.seed, { left, top }]} />
        ))}
      </View>
    </View>
  );
}

export function Raspberry() {
  const berries = [
    [22, 0],
    [8, 11],
    [35, 10],
    [0, 28],
    [24, 26],
    [48, 27],
    [9, 46],
    [36, 47],
  ];

  return (
    <View style={styles.raspberry}>
      {berries.map(([left, top]) => (
        <View
          key={`${left}-${top}`}
          style={[styles.raspberryCell, { left, top }]}
        />
      ))}
    </View>
  );
}

export function Kiwi() {
  const seeds = [
    [50, 16],
    [63, 23],
    [73, 38],
    [72, 55],
    [61, 70],
    [44, 76],
    [29, 69],
    [18, 53],
    [19, 34],
    [32, 21],
  ];

  return (
    <View style={styles.kiwiOuter}>
      <View style={styles.kiwiInner}>
        <View style={styles.kiwiCenter} />
        {seeds.map(([left, top]) => (
          <View
            key={`${left}-${top}`}
            style={[styles.kiwiSeed, { left, top }]}
          />
        ))}
      </View>
    </View>
  );
}

export function Banana() {
  return (
    <View style={styles.bananaWrap}>
      <View style={styles.bananaBack} />
      <View style={styles.banana} />
      <View style={styles.bananaStem} />
      <View style={styles.bananaTip} />
    </View>
  );
}

export function OrangeSlice() {
  return (
    <View style={styles.orangeSlice}>
      <View style={styles.orangeFruit}>
        <View style={styles.orangeLineOne} />
        <View style={styles.orangeLineTwo} />
        <View style={styles.orangeLineThree} />
      </View>
    </View>
  );
}
