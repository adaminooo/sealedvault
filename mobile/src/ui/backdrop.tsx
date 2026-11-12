import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Glow } from './glow';
import { color, space } from './theme';

const CELL = 40;
const GRID_H = 440;

/**
 * Pozadí ve stylu webu: jemná mřížka, která od horního středu mizí do ztracena,
 * fialové a modré záře, které se pomalu přelévají, a tenká světelná linka („horizont“).
 * Vkládá se jako první prvek obsahu posuvné obrazovky (posouvá se s obsahem, nic nezakrývá).
 */
export const Backdrop = memo(function Backdrop({ inset = space.lg }: { inset?: number }) {
  const { width } = useWindowDimensions();
  const cols = Math.ceil(width / CELL) + 1;
  const rows = Math.ceil(GRID_H / CELL) + 1;
  const ox = (width % CELL) / 2;

  return (
    <View pointerEvents="none" style={[styles.wrap, { width, left: -inset }]}>
      {/* mřížka + vyblednutí dolů a do stran (přechod do barvy pozadí) */}
      <View style={{ height: GRID_H }}>
        <Svg width={width} height={GRID_H}>
          {Array.from({ length: cols }, (_, i) => (
            <Line key={`v${i}`} x1={ox + i * CELL} x2={ox + i * CELL} y1={0} y2={GRID_H} stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
          ))}
          {Array.from({ length: rows }, (_, i) => (
            <Line key={`h${i}`} x1={0} x2={width} y1={i * CELL} y2={i * CELL} stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
          ))}
        </Svg>
        <LinearGradient colors={['rgba(5,5,7,0)', 'rgba(5,5,7,0.6)', color.bg]} locations={[0.25, 0.65, 1]} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[color.bg, 'rgba(5,5,7,0)', 'rgba(5,5,7,0)', color.bg]} locations={[0, 0.3, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </View>

      {/* záře nad mřížkou (průsvitné) */}
      <Glow size={560} color="#8f6bff" opacity={0.42} style={{ left: -240, top: -150 }} drift={{ x: 70, y: 50, scale: 1.1, ms: 14000 }} />
      <Glow size={480} color="#4f7dff" opacity={0.28} style={{ right: -230, top: -60 }} drift={{ x: -60, y: 60, scale: 0.92, ms: 18000 }} />
      <Glow size={520} color="#6d5cff" opacity={0.16} style={{ left: width * 0.05, top: 420 }} />

      {/* horizont */}
      <LinearGradient colors={['transparent', 'rgba(143,107,255,0.55)', 'rgba(79,125,255,0.55)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.horizon} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: -140, height: 960, overflow: 'hidden' },
  horizon: { position: 'absolute', left: '8%', right: '8%', top: 140, height: 1, boxShadow: '0 0 30px 4px rgba(143,107,255,0.22)' },
});
