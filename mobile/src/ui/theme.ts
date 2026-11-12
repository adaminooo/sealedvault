/**
 * Design tokeny SealedVault – stejné hodnoty jako web (src/index.css), jediný zdroj pravdy pro appku.
 * Appka je jen v tmavém režimu (stejně jako web).
 */
export const color = {
  bg: '#050507',
  surface: '#0d0d12',
  surface2: '#15151d',
  surface3: '#1f1f2a',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#f5f5f7',
  muted: '#9a9aad',
  faint: '#60606f',
  accent: '#8f6bff',
  accent2: '#a99dff',
  brand2: '#4f7dff',
  accentGlow: 'rgba(143,107,255,0.35)',
  gold: '#ffc65c',
  onGold: '#1a1205',
  pos: '#3ddc84',
  posBg: 'rgba(61,220,132,0.13)',
  neg: '#ff4d6a',
  negBg: 'rgba(255,77,106,0.13)',
  onColor: '#06060a',
  spark: 'rgba(232,232,242,0.62)',
} as const;

/** Značkový přechod (tlačítka, zvýraznění) */
export const gradient = {
  brand: ['#9b7bff', '#6d5cff', '#4f7dff'] as const,
  gold: ['#ffd978', '#ffb547'] as const,
};

/**
 * Barvy her – ze stejných tónů jako logo (levandulová, značková modrá, tyrkysová),
 * aby grafy a štítky ladily s ostatním vzhledem. [hlavní barva, přechod od, přechod do]
 */
export const gameColor = {
  'Pokémon': ['#b8a9ff', '#c4b5ff', '#8f6bff'],
  'One Piece': ['#5b86ff', '#7a9bff', '#3d5fe0'],
  Riftbound: ['#2dd4d8', '#8ef6f2', '#139fb8'],
} as const;

export const radius = { lg: 20, md: 16, sm: 12, pill: 999 } as const;

/** Rozestupy po 4 bodech */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Písma – načtená v app/_layout.tsx */
export const font = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Typografická škála */
export const type = {
  hero: { fontFamily: font.displayBold, fontSize: 40, letterSpacing: -1.2, lineHeight: 44 },
  title: { fontFamily: font.display, fontSize: 28, letterSpacing: -0.6, lineHeight: 32 },
  heading: { fontFamily: font.display, fontSize: 20, letterSpacing: -0.3, lineHeight: 24 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: font.body, fontSize: 13, lineHeight: 17 },
  overline: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 0.8, lineHeight: 14, textTransform: 'uppercase' as const },
} as const;

export type TypeVariant = keyof typeof type;
export type Tone = 'pos' | 'neg' | 'neutral';

export const toneColor: Record<Tone, string> = { pos: color.pos, neg: color.neg, neutral: color.muted };
