export const PWA_THEME_COLOR = "#842CC3";
export const PWA_SECONDARY_COLOR = "#87F3A4";
export const PWA_BACKGROUND_COLOR = "#ffffff";
export const PWA_ICON_192_PATH = "/pwa/icon-192.png";
export const PWA_ICON_512_PATH = "/pwa/icon-512.png";
export const PWA_MANIFEST_PATH = "/manifest.webmanifest";
export const PWA_SERVICE_WORKER_PATH = "/service-worker.js";

export const PWA_CACHE_NAMES = {
  static: "azure-ganttops-pwa-static-v1",
  runtime: "azure-ganttops-pwa-runtime-v1"
} as const;

export const PWA_CACHE_ALLOWLIST = [
  PWA_MANIFEST_PATH,
  PWA_ICON_192_PATH,
  PWA_ICON_512_PATH
] as const;

export const PWA_CACHE_BYPASS_EXACT_PATHS = ["/"] as const;
export const PWA_CACHE_BYPASS_PATH_PREFIXES = ["/phase2/"] as const;
export const PWA_HTML_ACCEPT_HEADER_VALUE = "text/html";
export const PWA_NETWORK_FIRST_ASSET_PATH_PREFIX = "/dist/";
export const PWA_NETWORK_FIRST_ASSET_EXTENSIONS = [".js", ".css"] as const;
