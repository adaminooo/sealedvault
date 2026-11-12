import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Game, PortfolioItem } from '@/core/types';

import { AppText } from './text';
import { color, font } from './theme';

export const GAME_COLOR: Record<Game, string> = {
  'Pokémon': '#b08a0c',
  'One Piece': '#d0517a',
  Riftbound: '#2b9fd6',
};

/** Obrázek produktu (fotka z TCGplayeru / vlastní), jinak barevná dlaždice s iniciálou hry */
export const ProductThumb = memo(function ProductThumb({ item, size = 48 }: { item: Pick<PortfolioItem, 'productImage' | 'image' | 'game' | 'name'>; size?: number }) {
  const uri = item.productImage || item.image;
  const tint = GAME_COLOR[item.game] ?? color.accent;
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.25 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={process.env.EXPO_OS === 'web' ? 0 : 150} recyclingKey={uri} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: tint + '26' }]}>
          <AppText style={{ fontFamily: font.displayBold, fontSize: size * 0.4 }} color={tint}>
            {item.game[0]}
          </AppText>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: color.surface2, borderCurve: 'continuous' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
