import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { AppText } from './text';
import type { TypeVariant } from './theme';

/**
 * Číslo, které se při změně plynule „dopočítá“ (count-up). Respektuje systémové Omezit pohyb.
 * `format` převádí hodnotu na text (měna, procenta…).
 */
export function AnimatedNumber({ value, format, variant = 'hero', color, duration = 700 }: { value: number; format: (n: number) => string; variant?: TypeVariant; color?: string; duration?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, reduce, duration]);

  return (
    <AppText variant={variant} color={color} tabular adjustsFontSizeToFit numberOfLines={1} selectable accessibilityLabel={format(value)}>
      {format(Math.round(shown))}
    </AppText>
  );
}
