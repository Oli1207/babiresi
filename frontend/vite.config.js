import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // ✅ tu as déjà ces fichiers ? sinon enlève ceux qui n’existent pas
      includeAssets: [
        "favicon-16x16.png",
        "favicon-32x32.png",
        "icon-72x72.png",
        "icon-96x96.png",
        "icon-128x128.png",
        "icon-144x144.png",
        "icon-152x152.png",
        "icon-192x192.png",
        "icon-384x384.png",
        "icon-512x512.png",
      ],

      manifest: {
        name: "Babiresi",
        short_name: "Babiresi",
        description: "Réservation de résidences à Abidjan",
        theme_color: "#111111",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/icon-72x72.png", sizes: "72x72", type: "image/png" },
          { src: "/icon-96x96.png", sizes: "96x96", type: "image/png" },
          { src: "/icon-128x128.png", sizes: "128x128", type: "image/png" },
          { src: "/icon-144x144.png", sizes: "144x144", type: "image/png" },
          { src: "/icon-152x152.png", sizes: "152x152", type: "image/png" },
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-384x384.png", sizes: "384x384", type: "image/png" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },

      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}"],
      },
    }),
  ],
});
