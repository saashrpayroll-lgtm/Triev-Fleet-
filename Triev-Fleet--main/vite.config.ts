import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { VitePWA } from 'vite-plugin-pwa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  root: path.resolve(__dirname, './'),
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate' — new service worker activates immediately without user interaction.
      // Prevents the PWA from being stuck on old code on mobile devices.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Triev Fleet Manager',
        short_name: 'Triev Fleet',
        description: 'The ultimate fleet management solution for EVs',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#7c3aed',
        background_color: '#0f172a',
        icons: [
          { src: 'pwa-icon.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB limit
        // ✅ FIX: Do NOT cache Supabase API calls — the app relies on real-time data.
        runtimeCaching: [
          {
            // Static assets only — cache-first for speed
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        // Don't cache the SW itself or the manifest
        navigateFallbackDenylist: [/^\/api/],
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false, // Disable sourcemaps in production — halves build size
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
          }
        }
      }
    }
  },
  esbuild: {
    drop: ['debugger'],
  },
})
