import { useEffect, useMemo, useState } from 'react';

import { cachedOnePieceSets, cachedPokemonSets, loadOnePieceSets, loadPokemonSets, RIFTBOUND_SETS, type SetInfo } from '@/core/catalog';
import type { Game } from '@/core/types';

/** Katalog edic pro danou hru (Pokémon a One Piece se stahují, Riftbound je v appce) */
export function useSetCatalog(game: Game): SetInfo[] {
  const [pokemon, setPokemon] = useState<SetInfo[]>(cachedPokemonSets);
  const [onePiece, setOnePiece] = useState<SetInfo[]>(cachedOnePieceSets);

  useEffect(() => {
    let alive = true;
    if (game === 'Pokémon') loadPokemonSets().then((s) => alive && setPokemon(s)).catch(() => {});
    if (game === 'One Piece') loadOnePieceSets().then((s) => alive && setOnePiece(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [game]);

  return useMemo(() => (game === 'Pokémon' ? pokemon : game === 'One Piece' ? onePiece : RIFTBOUND_SETS), [game, pokemon, onePiece]);
}
