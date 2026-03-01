import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' — the new service worker waits for user to reload,
      // preventing the stale-cache trap that caused "stuck on mobile" issues.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Triev Fleet Manager',
        short_name: 'Triev Fleet',
        description: 'The ultimate fleet management solution for EVs',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-icon.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-icon.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Only cache JS/CSS/HTML — not large API responses
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB limit
        // Cache strategies
        runtimeCaching: [
          {
            // Supabase API calls — network-first, fall back to cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }, // 5 min TTL
            },
          },
          {
            // Static assets — cache-first for speed
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
    chunkSizeWarningLimit: 1000, // Restore warning at 1MB so we catch regressions
    rollupOptions: {
      output: {
        // Manual chunk splitting for large libraries — each loads independently
        manualChunks: {
          // React core — cached long term, changes rarely
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'supabase': ['@supabase/supabase-js'],
          // Charts — only loaded on analytics/dashboard pages
          'charts': ['recharts'],
          // PDF export — only loaded on demand
          'pdf': ['jspdf', 'jspdf-autotable'],
          // Animation library
          'framer': ['framer-motion'],
          // Icons
          'icons': ['lucide-react'],
          // Data utilities
          'data-utils': ['date-fns', 'papaparse', 'xlsx', 'zod'],
        }
      }
    }
  },
})
