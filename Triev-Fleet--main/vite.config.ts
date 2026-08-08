import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
        // Only cache JS/CSS/HTML — not large API responses
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB limit
        // ✅ FIX: Do NOT cache Supabase API calls — the app relies on real-time data.
        // Caching API responses causes stale data on slow mobile connections.
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
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
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
