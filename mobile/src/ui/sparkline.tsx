import { memo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** Body → cesta SVG v rámečku w×h (s okrajem pro tloušťku čáry) */
export function linePath(values: number[], w: number, h: number, pad = 2) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, pad + (h - pad * 2) * (1 - (v - min) / span)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return { line, area: `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`, pts };
}

/** Malá křivka vývoje (řádek produktu, hlavní karta) – barva podle toho, jestli roste */
export const Sparkline = memo(function Sparkline({ values, width, height, color, fill = false }: { values: number[]; width: number; height: number; color: string; fill?: boolean }) {
  if (values.length < 2) return null;
  const { line, area } = linePath(values, width, height);
  return (
    <Svg width={width} height={height}>
      {fill && (
        <>
          <Defs>
            <LinearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#sf)" />
        </>
      )}
      <Path d={line} stroke={color} strokeWidth={fill ? 2 : 1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
});

/** Křivka přes celou šířku rodiče */
export function WideSparkline(props: { values: number[]; height: number; color: string; fill?: boolean }) {
  const [w, setW] = useState(0);
  return (
    <View style={{ height: props.height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && <Sparkline {...props} width={w} />}
    </View>
  );
}
