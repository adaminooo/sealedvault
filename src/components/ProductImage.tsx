import { useState } from 'react';
import type { PortfolioItem, ProductType } from '../types';
import { GAME_COLORS } from './GameChart';

export const TYPE_ABBR: Record<ProductType, string> = {
  'Booster box': 'BB',
  ETB: 'ETB',
  Display: 'DSP',
  'Booster bundle': 'BND',
  UPC: 'UPC',
  'Premium Collection': 'PC',
  'Collection box': 'COL',
  Tin: 'TIN',
  Blister: 'BLI',
  Booster: 'PCK',
  Deck: 'DCK',
  Jiné: '•••',
};

type Props = Pick<PortfolioItem, 'game' | 'type' | 'image' | 'setLogo' | 'productImage'> & { size?: 'md' | 'lg' | 'xl' };

/** Obrázek produktu: vlastní fotka → fotka produktu z TCGplayeru → logo edice → zkratka typu v barvě hry */
export function ProductImage({ game, type, image, productImage, setLogo, size = 'md' }: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const color = GAME_COLORS[game];
  const src = [image, productImage, setLogo].find((s): s is string => !!s && !failed.includes(s)) ?? null;
  const kind = !src ? '' : src === image ? 'photo' : src === productImage ? 'product' : 'logo';

  return (
    <span
      className={`avatar ${size} ${kind}`}
      style={src ? undefined : { background: `${color}2e`, boxShadow: `inset 0 0 0 1.5px ${color}` }}
      title={`${game} · ${type}`}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed((f) => [...f, src])} />
      ) : (
        TYPE_ABBR[type]
      )}
    </span>
  );
}
