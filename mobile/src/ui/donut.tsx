import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

type Segment = { share: number; color: string; key: string; gradient?: readonly [string, string] };

/**
 * Prstencový graf: segmenty v pořadí, `share` 0–1. Každý segment může mít přechod barev,
 * mezery mezi segmenty a zaoblené konce; nezvýrazněné segmenty se ztlumí.
 */
export function Donut({ segments, size = 132, stroke = 14, highlight }: { segments: Segment[]; size?: number; stroke?: number; highlight?: string | null }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.share > 0);
  // zaoblené konce přesahují o půl tloušťky na každé straně → mezera musí být aspoň tloušťka
  const gap = visible.length > 1 ? stroke + 4 : 0;
  // začátek každého segmentu = součet předchozích
  const starts = visible.map((_, i) => visible.slice(0, i).reduce((a, s) => a + s.share * len, 0));

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        {visible.map((s, i) =>
          s.gradient ? (
            <LinearGradient key={s.key} id={`${uid}${i}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={s.gradient[0]} />
              <Stop offset="1" stopColor={s.gradient[1]} />
            </LinearGradient>
          ) : null,
        )}
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
      {visible.map((s, i) => (
        <Circle
          key={s.key}
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={s.gradient ? `url(#${uid}${i})` : s.color}
          strokeWidth={stroke}
          strokeLinecap={gap ? 'round' : 'butt'}
          strokeDasharray={`${Math.max(0.01, s.share * len - gap)} ${len}`}
          strokeDashoffset={-(starts[i] + gap / 2)}
          opacity={highlight && highlight !== s.key ? 0.25 : 1}
          fill="none"
        />
      ))}
    </Svg>
  );
}
