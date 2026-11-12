import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { linePath } from './sparkline';
import { color as C } from './theme';

type Props = {
  /** body [datum, hodnota] */
  points: [string, number][];
  height?: number;
  color: string;
  /** Kurzor prstem: index bodu (null = prst pryč) */
  onScrub?: (index: number | null) => void;
};

/** Graf s dotykovým kurzorem – táhni prstem a hodnota nahoře ukazuje den pod prstem */
export function LineChart({ points, height = 200, color, onScrub }: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const last = useRef<number | null>(null);

  const values = points.map(([, v]) => v);
  const geo = width > 0 && values.length >= 2 ? linePath(values, width, height, 4) : null;

  const pick = (x: number) => {
    if (!geo) return;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(((x - 4) / (width - 8)) * (values.length - 1))));
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
      {geo && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.3} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={geo.area} fill="url(#lc)" />
          <Path d={geo.line} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {active != null && (
            <>
              <Line x1={geo.pts[active][0]} x2={geo.pts[active][0]} y1={0} y2={height} stroke={C.borderStrong} strokeWidth={1} />
              <Circle cx={geo.pts[active][0]} cy={geo.pts[active][1]} r={5} fill={color} stroke={C.bg} strokeWidth={2} />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

