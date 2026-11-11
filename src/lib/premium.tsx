import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Funkce, které patří do Premium */
export type PremiumFeature = 'history' | 'alerts' | 'analytics' | 'portfolios' | 'export';

export const TRIAL_DAYS = 14;
const KEY = 'tcg-portfolio:premium';
const DAY = 864e5;

interface Stored {
  /** začátek zkušební verze (ISO) */
  trialStart?: string;
}

interface PremiumCtx {
  isPremium: boolean;
  trialUsed: boolean;
  daysLeft: number;
  startTrial: () => void;
  endTrial: () => void;
  /** otevřené okno Premium (null = zavřené); 'general' = bez konkrétní funkce */
  paywall: PremiumFeature | 'general' | null;
  openPaywall: (f?: PremiumFeature) => void;
  closePaywall: () => void;
}

const Ctx = createContext<PremiumCtx | null>(null);

function read(): Stored {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Stored;
  } catch {
    return {};
  }
}

function write(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* úložiště nedostupné */
  }
}

/**
 * Náhled Premium bez plateb: 14denní zkušební verze uložená v zařízení.
 * Až budou platby (Stripe), přibude sem ověření předplatného.
 */
export function PremiumProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(read);
  const [paywall, setPaywall] = useState<PremiumCtx['paywall']>(null);

  const started = stored.trialStart ? new Date(stored.trialStart).getTime() : NaN;
  const left = Number.isFinite(started) ? started + TRIAL_DAYS * DAY - Date.now() : 0;
  const isPremium = left > 0;

  const startTrial = useCallback(() => {
    const s = { trialStart: new Date().toISOString() };
    write(s);
    setStored(s);
  }, []);

  // ukončí zkušební verzi (aby šlo vidět verzi zdarma); znovu spustit už nejde
  const endTrial = useCallback(() => {
    const s = { trialStart: new Date(Date.now() - (TRIAL_DAYS + 1) * DAY).toISOString() };
    write(s);
    setStored(s);
  }, []);

  const value = useMemo<PremiumCtx>(
    () => ({
      isPremium,
      trialUsed: !!stored.trialStart,
      daysLeft: isPremium ? Math.ceil(left / DAY) : 0,
      startTrial,
      endTrial,
      paywall,
      openPaywall: (f) => setPaywall(f ?? 'general'),
      closePaywall: () => setPaywall(null),
    }),
    [isPremium, stored.trialStart, left, startTrial, endTrial, paywall],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePremium(): PremiumCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePremium mimo PremiumProvider');
  return c;
}
