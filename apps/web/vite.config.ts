import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "icons/*.png",
      ],
      manifest: false,           // use existing public/manifest.json
      workbox: {
        // Precache the app shell (HTML, JS, CSS, fonts)
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Offline fallback
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // Runtime caching for API calls
        runtimeCaching: [
          {
            // Song media — never cache. The route answers 302 to a presigned
            // URL that expires in minutes, and audio is streamed only, so a
            // cached copy is both stale and a quiet drain on a phone's storage.
            // Must come before the songs rule below, which would also match it.
            urlPattern: /^https?:\/\/.*\/api\/songs\/[^/]+\/media\//,
            handler: "NetworkOnly",
          },
          {
            // API data — network first, fallback to cache
            urlPattern: /^https?:\/\/.*\/api\/(songs|setlists|events|users|organizations)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-data",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Google Fonts stylesheets — stale-while-revalidate
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts webfont files — cache first (immutable)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5176,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },

      "/health": "http://127.0.0.1:3001",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
