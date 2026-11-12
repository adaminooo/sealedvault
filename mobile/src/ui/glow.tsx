import { useEffect, useId } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Měkká světelná záře (kruhový přechod do ztracena) – jako „orby“ na webu.
 * Volitelně se pomalu přelévá (drift); při systémovém Omezit pohyb stojí.
 */
export function Glow({ size, color, opacity = 1, style, drift }: { size: number; color: string; opacity?: number; style?: ViewStyle; drift?: { x: number; y: number; scale?: number; ms: number } }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduce = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!drift || reduce) return;
    t.value = withRepeat(withTiming(1, { duration: drift.ms, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift, reduce, t]);

  const anim = useAnimatedStyle(() =>
    drift
      ? { transform: [{ translateX: drift.x * t.value }, { translateY: drift.y * t.value }, { scale: 1 + ((drift.scale ?? 1) - 1) * t.value }] }
      : {},
  );

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, anim]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
