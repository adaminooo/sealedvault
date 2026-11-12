import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { LOCALE } from '@/core/i18n';

import { AppText } from './text';
import { color as C, space } from './theme';

type Props = {
  /** body [datum, hodnota] */
  points: [string, number][];
  /** Druhá řada ve stejných dnech (např. investováno) – čárkovaně */
  secondary?: number[];
  height?: number;
  color: string;
  /** Popisek osy Y (zkrácená částka) – bez něj se osy nekreslí */
  formatY?: (v: number) => string;
  /** Legenda pod grafem */
  legend?: { primary: string; secondary?: string };
  /** Kurzor prstem: index bodu (null = prst pryč) */
  onScrub?: (index: number | null) => void;
};

const AXIS_H = 20;
const PAD = 4;
const dateFmt = (iso: string, long: boolean) =>
  new Date(iso + 'T12:00:00').toLocaleDateString(LOCALE, long ? { day: 'numeric', month: 'numeric', year: '2-digit' } : { day: 'numeric', month: 'numeric' });

/** 2–4 „kulaté“ hodnoty osy Y uvnitř rozsahu (krok 1 / 2 / 5 × 10ⁿ) */
export function niceTicks(min: number, max: number): number[] {
  const raw = (max - min) / 4;
  if (!(raw > 0)) return [];
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  return out.slice(-4);
}

/** Graf s dotykovým kurzorem, osami a volitelnou druhou (čárkovanou) řadou */
export function LineChart({ points, secondary, height = 200, color, formatY, legend, onScrub }: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const last = useRef<number | null>(null);

  const values = points.map(([, v]) => v);
  const axes = !!formatY;
  const plotH = axes ? height - AXIS_H : height;
  const all = secondary ? [...values, ...secondary] : values;
  let min = Math.min(...all);
  let max = Math.max(...all);
  const span0 = max - min || Math.abs(max) || 1;
  min -= span0 * 0.08;
  max += span0 * 0.08;
  if (min < 0 && Math.min(...all) >= 0) min = 0;
  const span = max - min || 1;

  const ok = width > 0 && values.length >= 2;
  const step = ok ? (width - PAD * 2) / (values.length - 1) : 0;
  const x = (i: number) => PAD + i * step;
  const y = (v: number) => PAD + (plotH - PAD * 2) * (1 - (v - min) / span);
  const path = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const line = ok ? path(values) : '';
  const area = ok ? `${line} L${x(values.length - 1).toFixed(1)},${plotH} L${x(0).toFixed(1)},${plotH} Z` : '';
  const grid = axes ? niceTicks(min, max) : [];
  const longDates = points.length > 1 && points[0][0].slice(0, 4) !== points[points.length - 1][0].slice(0, 4);

  const pick = (px: number) => {
    if (!ok) return;
    const i = Math.max(0, Math.min(values.length - 1, Math.round((px - PAD) / step)));
    if (i === last.current) return;
    last.current = i;
    setActive(i);
    onScrub?.(i);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };
  const release = () => {
    last.current = null;
    setActive(null);
    onScrub?.(null);
  };

  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{ height }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={release}
        onResponderTerminate={release}
        accessibilityRole="image">
        {ok && (
          <Svg width={width} height={plotH}>
            <Defs>
              <LinearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.3} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {grid.map((g, i) => (
              <Line key={i} x1={0} x2={width} y1={y(g)} y2={y(g)} stroke={C.border} strokeWidth={1} />
            ))}
            <Path d={area} fill="url(#lc)" />
            {secondary && secondary.length === values.length && (
              <Path d={path(secondary)} stroke={C.muted} strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
            )}
            <Path d={line} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {active != null && (
              <>
                <Line x1={x(active)} x2={x(active)} y1={0} y2={plotH} stroke={C.borderStrong} strokeWidth={1} />
                {secondary?.[active] != null && <Circle cx={x(active)} cy={y(secondary[active])} r={3.5} fill={C.muted} stroke={C.bg} strokeWidth={1.5} />}
                <Circle cx={x(active)} cy={y(values[active])} r={5} fill={color} stroke={C.bg} strokeWidth={2} />
              </>
            )}
          </Svg>
        )}
        {ok &&
          axes &&
          grid.map((g, i) => (
            <AppText key={i} variant="caption" color={C.faint} tabular style={[styles.yLabel, { top: y(g) - 16 }]}>
              {formatY!(g)}
            </AppText>
          ))}
        {ok && axes && (
          <View style={styles.xAxis} pointerEvents="none">
            {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((i, k) => (
              <AppText key={k} variant="caption" color={C.faint} tabular>
                {dateFmt(points[i][0], longDates)}
              </AppText>
            ))}
          </View>
        )}
      </View>
      {legend && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <AppText variant="caption" color={C.muted}>
              {legend.primary}
            </AppText>
          </View>
          {legend.secondary && secondary && (
            <View style={styles.legendItem}>
              <View style={[styles.swatch, styles.dashed]} />
              <AppText variant="caption" color={C.muted}>
                {legend.secondary}
              </AppText>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute', left: 2, fontSize: 11 },
  xAxis: { position: 'absolute', left: 0, right: 0, bottom: 0, height: AXIS_H, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  legend: { flexDirection: 'row', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  dashed: { backgroundColor: 'transparent', borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.muted, height: 0 },
});
