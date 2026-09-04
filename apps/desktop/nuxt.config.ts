import { fileURLToPath } from "node:url";

import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  compatibilityDate: "2026-09-04",
  ssr: false,

  // Keep Nuxt's client source inside the existing Desktop renderer boundary.
  srcDir: "src/renderer",
  // nuxt generate creates dist as a link to the static output, not renderer source.
  // Ignore the link itself as well as its contents in Nuxt and Vite watchers.
  ignore: ["dist", "dist/**"],
  // Resolve renderer helpers and the shared Desktop API from the src directory.
  alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  components: [{ path: "~/components", extensions: ["vue"], pathPrefix: false }],
  css: ["~/assets/desktop.css"],
  app: { head: { title: "Tooldeck" } },

  devServer: {
    host: "localhost",
    port: 5173,
  },

  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },
  },

  modules: ["@pinia/nuxt", "@tdesign-vue-next/nuxt", "@nuxtjs/i18n", "@unocss/nuxt"],

  // Use hash navigation for the loadFile renderer; verify in the packaged app.
  router: {
    options: {
      hashMode: true,
    },
  },

  tdesign: {
    resolveIcons: true,
    // Use the module's default ES build with compiled CSS. The esm build adds
    // dayjs to build.transpile, excluding its CommonJS files from Vite optimization.
    esm: false,
  },

  i18n: {
    strategy: "no_prefix",
    detectBrowserLanguage: false,
    // Bootstrap fallback only; Tooldeck preferences own the effective locale.
    defaultLocale: "en-US",
    locales: ["en-US", "zh-CN"],
    restructureDir: "src/renderer/i18n",
    vueI18n: "./i18n.config.ts",
  },

  experimental: {
    // Host capabilities remain behind window.tooldeck, not Node polyfills.
    clientNodeCompat: false,
    // Packaged Electron uses loadFile and has no HTTP manifest/payload endpoint.
    appManifest: false,
    payloadExtraction: false,
  },

  nitro: {
    // build.mjs supplies NUXT_APP_BASE_URL=./ for the generated client URLs.
    // Nitro's prerender server still needs an absolute HTTP base path.
    baseURL: "/",
    output: { publicDir: fileURLToPath(new URL("./.vite/renderer", import.meta.url)) },
    prerender: { crawlLinks: false, routes: ["/"] },
  },
});
