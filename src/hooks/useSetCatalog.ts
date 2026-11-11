import { useEffect, useMemo, useState } from 'react';
import type { Game } from '../types';
import {
  cachedOnePieceSets,
  cachedPokemonSets,
  loadOnePieceSets,
  loadPokemonSets,
  RIFTBOUND_SETS,
  type SetInfo,
} from '../lib/catalog';

/** Katalog edic pro danou hru + edice, které uživatel už sám zadal */
export function useSetCatalog(game: Game, ownSets: string[] = []) {
  const [pokemon, setPokemon] = useState<SetInfo[]>(cachedPokemonSets);
  const [onePiece, setOnePiece] = useState<SetInfo[]>(cachedOnePieceSets);

  useEffect(() => {
    let alive = true;
    if (game === 'Pokémon') loadPokemonSets().then((s) => alive && setPokemon(s));
    if (game === 'One Piece') loadOnePieceSets().then((s) => alive && setOnePiece(s));
    return () => {
      alive = false;
    };
  }, [game]);

  return useMemo(() => {
    const base = game === 'Pokémon' ? pokemon : game === 'One Piece' ? onePiece : RIFTBOUND_SETS;
    const known = new Set(base.map((s) => s.name.toLowerCase()));
    const extra = ownSets
      .filter((n) => !known.has(n.toLowerCase()))
      .map<SetInfo>((name) => ({ id: `own-${name}`, name, game }));
    return [...extra, ...base];
  }, [game, pokemon, onePiece, ownSets]);
}
