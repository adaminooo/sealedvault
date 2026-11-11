import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages servíruje appku z podadresáře repozitáře (např. /sealedvault/) – nastaví workflow přes BASE_PATH.
// Lokálně (PC verze, npm run dev / preview) běží z kořene.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  // Lightning CSS při minifikaci zahazoval standardní backdrop-filter (zůstal jen -webkit-) → v Chromu nefungovalo rozmazání
  // (CSS se proto nezmenšuje – po gzipu ~18 kB, rozdíl zanedbatelný)
  build: { cssMinify: false },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SealedVault TCG',
        short_name: 'SealedVault',
        description: 'Sledování hodnoty sealed TCG produktů (Pokémon, One Piece, Riftbound)',
        lang: 'cs',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#050507',
        theme_color: '#050507',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // denní data se do mezipaměti appky nebalí – načítají se čerstvá (offline z mezipaměti níže)
        globIgnores: ['data/**'],
        navigateFallbackDenylist: [/\/data\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'daily-data',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // loga edic a fotky produktů – ať se zobrazují i offline
            urlPattern: ({ url }) =>
              ['images.pokemontcg.io', 'images.scrydex.com', 'tcgplayer-cdn.tcgplayer.com'].includes(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'set-logos',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'api.pokemontcg.io',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'set-catalog', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
});
