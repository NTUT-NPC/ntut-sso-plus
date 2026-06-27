import { defineConfig } from "wxt";
import pkg from "./package.json";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  outDir: "dist",
  modules: ["@wxt-dev/module-vue"],
  vite: () => ({
    optimizeDeps: {
      entries: ["src/entrypoints/popup/index.html"],
    },
  }),
  manifest: (env) => ({
    name: "NTUT SSO+",
    version: pkg.version,
    description:
      "提供北科學生快速登入校內系統的擴充功能。",
    permissions: env.browser === 'firefox'
      ? ["storage", "declarativeNetRequest", "downloads", "tabs"]
      : ["storage", "declarativeNetRequest", "downloads", "tabs", "sidePanel"],
    side_panel: {
      default_path: "popup.html",
    },
    sidebar_action: {
      default_panel: "popup.html",
      default_title: "NTUT SSO+",
      default_icon: "icons/icon48.png"
    },
    host_permissions: [
      "https://*.ntut.edu.tw/*",
    ],
    homepage_url: "https://github.com/NTUT-NPC/ntut-sso-plus",
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
    declarative_net_request: {
      rule_resources: [
        {
          id: "ruleset_1",
          enabled: true,
          path: "rules.json",
        },
      ],
    },
    web_accessible_resources: [
      {
        resources: ["assets/video.gif", "icons/*.png"],
        matches: ["<all_urls>"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: "ntut-sso-plus@ntut-npc",
        strict_min_version: "142.0",
        data_collection_permissions: {
          required: ["none"],
          optional: [],
        },
      } as any,
    },
  }),
});
