import {
  PWA_BACKGROUND_COLOR,
  PWA_ICON_192_PATH,
  PWA_ICON_512_PATH,
  PWA_THEME_COLOR
} from "./pwa-constants.js";

export const PWA_MANIFEST = {
  name: "AzureGanttOps",
  short_name: "GanttOps",
  id: "/",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: PWA_BACKGROUND_COLOR,
  theme_color: PWA_THEME_COLOR,
  icons: [
    {
      src: PWA_ICON_192_PATH,
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable"
    },
    {
      src: PWA_ICON_512_PATH,
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    }
  ]
} as const;

export const PWA_MANIFEST_JSON = `${JSON.stringify(PWA_MANIFEST, null, 2)}\n`;
