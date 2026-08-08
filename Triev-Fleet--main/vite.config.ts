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
          // XLSX — heavy (280KB), only used on export/import pages
          'xlsx-lib': ['xlsx'],
          // CSV parser — only used in DataImport + exportUtils
          'csv-lib': ['papaparse'],
          // Light data utilities — used widely, tree-shakes well
          'data-utils': ['date-fns', 'zod'],
        }
      }
    }
  },
  esbuild: {
    // SECURITY HARDENING: Drop all console.log and debugger statements in production builds
    // Prevents accidental leakage of user data, API responses, or system architecture to the public browser console.
    drop: ['console', 'debugger'],
  },
})
