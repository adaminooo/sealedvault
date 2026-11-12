import Svg, { Circle } from 'react-native-svg';

import { color as C } from './theme';

type Segment = { share: number; color: string; key: string };

/** Prstencový graf: segmenty v pořadí, `share` 0–1. Mezery mezi segmenty, zaoblené konce. */
export function Donut({ segments, size = 132, stroke = 14, highlight }: { segments: Segment[]; size?: number; stroke?: number; highlight?: string | null }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.share > 0);
  const gap = visible.length > 1 ? 4 : 0;
  // začátek každého segmentu = součet předchozích
  const starts = visible.map((_, i) => visible.slice(0, i).reduce((a, s) => a + s.share * len, 0));

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.surface3} strokeWidth={stroke} fill="none" />
      {visible.map((s, i) => (
        <Circle
          key={s.key}
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={s.color}
          strokeWidth={stroke}
          strokeLinecap={gap ? 'round' : 'butt'}
          strokeDasharray={`${Math.max(0, s.share * len - gap)} ${len}`}
          strokeDashoffset={-starts[i]}
          opacity={highlight && highlight !== s.key ? 0.3 : 1}
          fill="none"
        />
      ))}
    </Svg>
  );
}
