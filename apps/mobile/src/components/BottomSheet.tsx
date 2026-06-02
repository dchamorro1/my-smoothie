import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
} from "react-native-gesture-handler";

const SHEET_CLOSED_Y = 600;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  // Single value drives the slide animation and the drag; backdrop derives from it.
  const translateY = useRef(new Animated.Value(SHEET_CLOSED_Y)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SHEET_CLOSED_Y);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false,
      }).start();
    } else if (mounted) {
      Animated.timing(translateY, {
        toValue: SHEET_CLOSED_Y,
        duration: 240,
        useNativeDriver: false,
      }).start(() => setMounted(false));
    }
  }, [visible]);

  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    const ty = e.nativeEvent.translationY;
    if (ty > 0) translateY.setValue(ty);
  };

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.state !== State.END) return;
    const { translationY, velocityY } = e.nativeEvent;
    if (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) {
      onClose();
    } else {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
    }
  };

  if (!mounted) return null;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SHEET_CLOSED_Y],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
          <Animated.View
            style={[
              styles.sheetContainer,
              { paddingBottom: insets.bottom + 16, transform: [{ translateY }] },
            ]}
          >
            <View style={styles.sheetHandle} />
            {children}
          </Animated.View>
        </PanGestureHandler>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
});
