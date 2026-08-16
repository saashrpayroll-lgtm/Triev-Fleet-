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
        description: 'The ultimate fleet management solution for EVs — rider tracking, wallet, collections & team performance.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#7c3aed',
        background_color: '#0f172a',
        categories: ['business', 'productivity', 'finance'],
        icons: [
          { src: 'pwa-icon.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'Go to your main dashboard',
            url: '/dashboard',
            icons: [{ src: 'pwa-icon.png', sizes: '192x192' }]
          },
          {
            name: 'My Riders',
            short_name: 'Riders',
            description: 'View and manage your riders',
            url: '/tl/riders',
            icons: [{ src: 'pwa-icon.png', sizes: '192x192' }]
          },
          {
            name: 'Collections',
            short_name: 'Collections',
            description: 'View today\'s collections',
            url: '/tl/collection-history',
            icons: [{ src: 'pwa-icon.png', sizes: '192x192' }]
          },
          {
            name: 'Requests',
            short_name: 'Requests',
            description: 'View pending requests',
            url: '/tl/requests',
            icons: [{ src: 'pwa-icon.png', sizes: '192x192' }]
          }
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
            // Heavy PDF/Excel tools — load only when export is used
            if (id.includes('jspdf') || id.includes('jspdf-autotable')) return 'vendor-pdf';
            if (id.includes('xlsx') || id.includes('papaparse')) return 'vendor-data';
            // Charting — large lib, only on analytics/dashboard pages
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'vendor-charts';
            // Animation — only needed for landing + transitions
            if (id.includes('framer-motion')) return 'vendor-animation';
            // Icon library — large, chunk separately for caching
            if (id.includes('lucide-react')) return 'vendor-icons';
            // Supabase client
            if (id.includes('@supabase')) return 'vendor-supabase';
            // React router
            if (id.includes('react-router') || id.includes('react-router-dom')) return 'vendor-router';
            // React core
            if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
            // Table engine
            if (id.includes('@tanstack')) return 'vendor-table';
          }
        }
      }
    }
  },
  esbuild: {
    // Drop all console.* calls and debugger in production for security + performance
    drop: ['console', 'debugger'],
  },
})
