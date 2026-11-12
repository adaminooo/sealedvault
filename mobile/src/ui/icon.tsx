import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';

import { color as C } from './theme';

type MdName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Jedna ikona pro obě platformy: na iOS systémový SF Symbol, jinde (Android, web) Material ikona.
 * Každá ikona má proto oba názvy.
 */
export function Icon({ sf, md, size = 20, color = C.text, weight = 'semibold' }: { sf: SFSymbol; md: MdName; size?: number; color?: string; weight?: ComponentProps<typeof SymbolView>['weight'] }) {
  if (process.env.EXPO_OS === 'ios') {
    return <SymbolView name={sf} tintColor={color} weight={weight} resizeMode="scaleAspectFit" style={{ width: size, height: size }} />;
  }
  return <MaterialIcons name={md} size={size} color={color} />;
}
