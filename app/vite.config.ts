import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative, so the app works from a GitHub Pages sub-path without server rewrites (routing uses the hash).
  base: "./",
  plugins: [
    preact(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Doubletake",
        short_name: "Doubletake",
        description: "Design and knit a reversible double-knit beanie, round by round.",
        theme_color: "#1b2a41",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "./",
        scope: "./",
        lang: "en-GB",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2,json}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  server: { fs: { allow: [".."] } },
});
