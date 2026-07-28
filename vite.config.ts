import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    historyApiFallback: true,
    hmr: { overlay: false },
  },

  build: {
    // Raise chunk warning threshold to 1MB (just a warning, not an error)
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // ── Manual code splitting ─────────────────────────────────────────
        // Splits the giant index.js into smaller cacheable chunks so each
        // chunk stays well under the 2MB workbox precache limit.
        manualChunks: {
          // React core
          "vendor-react": ["react", "react-dom", "react/jsx-runtime"],

          // Router
          "vendor-router": ["react-router-dom"],

          // Radix UI primitives (large — split separately)
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],

          // Charting
          "vendor-charts": ["recharts"],

          // Supabase client
          "vendor-supabase": ["@supabase/supabase-js"],

          // Tanstack Query
          "vendor-query": ["@tanstack/react-query"],

          // Date utilities
          "vendor-date": ["date-fns"],

          // Form handling
          "vendor-form": ["react-hook-form", "@hookform/resolvers", "zod"],

          // Icons (lucide is large)
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "icons/*.png",
        "icons/apple-touch-icon.png",
      ],

      manifest: false,
      manifestFilename: "manifest.json",

      workbox: {
        // ── FIX: raise the per-file precache limit to 4MB ────────────────
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB

        // Only precache JS/CSS/HTML — skip large images (they're runtime cached)
        globPatterns: ["**/*.{js,css,html,woff2}"],

        runtimeCaching: [
          // Supabase API — network first, fall back to cache
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // OpenAI / Claude — never cache
          {
            urlPattern: /^https:\/\/(api\.openai\.com|api\.anthropic\.com)\/.*/i,
            handler: "NetworkOnly",
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Icons and images — runtime cache
          {
            urlPattern: /\/icons\/.*\.png$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "icons-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],

        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api\//],
      },

      devOptions: {
        enabled: false,
        type: "module",
      },
    }),
  ].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));