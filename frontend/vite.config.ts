import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Forzamos que el SW nuevo tome control de la pestaña abierta
        // sin esperar a que todas las pestañas se cierren. Importante
        // cuando una regla de caché estaba mal (como pasó con /geotrackers,
        // que necesita datos en vivo y no debe cachearse).
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Descargas de PDF/binarios: van directo a red, sin cache ni timeout.
            // El SW se cuelga con blobs y tarda demasiado en generarlos.
            urlPattern: ({ url, request }: { url: URL; request: Request }) =>
              request.method === 'GET' &&
              /\/api\/v1\//.test(url.pathname) &&
              /\/pdf$/.test(url.pathname),
            handler: 'NetworkOnly' as const,
          },
          {
            // Geolocalización: datos EN VIVO. Nunca cachear. Si el SW
            // guarda un 503 viejo acá, el mapa queda roto para siempre
            // (que es exactamente lo que paso al primer intento).
            urlPattern: ({ url, request }: { url: URL; request: Request }) =>
              request.method === 'GET' &&
              /\/api\/v1\/geotrackers\//.test(url.pathname),
            handler: 'NetworkOnly' as const,
          },
          {
            urlPattern: ({ url, request }: { url: URL; request: Request }) =>
              request.method === 'GET' && /\/api\/v1\//.test(url.pathname),
            handler: 'NetworkFirst' as const,
            options: {
              cacheName: 'duwhite-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'logo.svg', 'logo-white.svg'],
      manifest: {
        name: 'DUWHITE Gestión',
        short_name: 'DUWHITE',
        description: 'Sistema de gestión integral para DUWHITE Lavandería Industrial.',
        theme_color: '#3D3D3D',
        background_color: '#F7F8FA',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'es-AR',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
