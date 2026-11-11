import { flushSync } from 'react-dom';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Jemná vibrace při důležitých akcích (jen Android – iPhone vibrace z webu nepodporuje) */
export function haptic(ms = 8) {
  if (reduced()) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* nepodporováno */
  }
}

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => unknown };

/** Plynulý přechod mezi obrazovkami (View Transitions API), kde ho prohlížeč umí */
export function withTransition(update: () => void) {
  const doc = document as DocWithVT;
  if (!doc.startViewTransition || reduced()) return update();
  doc.startViewTransition(() => flushSync(update));
}
