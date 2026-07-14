import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Deliberately busy-loops the JS thread for 3 seconds — same idea as the
// very first exercise in Week 1, resurfacing here to prove the drag
// gesture below doesn't need the JS thread to keep running smoothly.
function blockJsThreadFor3Seconds() {
  const start = Date.now();
  while (Date.now() - start < 3000) {
    // busy-wait — nothing else on the JS thread can run during this
  }
  console.log('JS thread unfroze — did the card keep tracking your finger?');
}

export default function GestureDemo() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // These callbacks run as worklets — on the UI thread's own JS runtime,
  // never touching the main JS thread at all.
  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  // Also a worklet — re-runs on the UI thread whenever the shared values
  // change, applying the new transform directly. Note: transform, not
  // width/top/left — the one category the native compositor can handle
  // without a layout pass.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      <Pressable style={styles.blockButton} onPress={blockJsThreadFor3Seconds}>
        <Text style={styles.blockButtonText}>
          Block JS thread for 3s — try dragging the card during it
        </Text>
      </Pressable>

      <View style={styles.centerBox}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.card, animatedStyle]}>
            <Text style={styles.text}>Drag me</Text>
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  blockButton: {
    margin: 12,
    marginTop: 60,
    padding: 14,
    backgroundColor: '#dc2626',
    borderRadius: 8,
  },
  blockButtonText: { color: 'white', textAlign: 'center', fontWeight: '600' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: 140,
    height: 140,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: 'white', fontWeight: '700' },
});
