import {
  PWA_CACHE_ALLOWLIST,
  PWA_CACHE_BYPASS_EXACT_PATHS,
  PWA_CACHE_BYPASS_PATH_PREFIXES,
  PWA_CACHE_NAMES,
  PWA_HTML_ACCEPT_HEADER_VALUE,
  PWA_NETWORK_FIRST_ASSET_EXTENSIONS,
  PWA_NETWORK_FIRST_ASSET_PATH_PREFIX
} from "./pwa-constants.js";

type PwaStaticCacheName = typeof PWA_CACHE_NAMES.static;
type PwaRuntimeCacheName = typeof PWA_CACHE_NAMES.runtime;

export type PwaServiceWorkerCacheStrategy = "bypass" | "cache-first" | "network-first" | "unmanaged";

export type PwaServiceWorkerCacheDecision =
  | {
      strategy: "bypass" | "unmanaged";
    }
  | {
      strategy: "cache-first";
      cacheName: PwaStaticCacheName;
    }
  | {
      strategy: "network-first";
      cacheName: PwaRuntimeCacheName;
    };

export type PwaServiceWorkerCacheDecisionInput = {
  method: string;
  url: string | URL;
  origin: string;
  mode?: string;
  acceptHeader?: string | null;
};

export type PwaCacheBypassInput = {
  pathname: string;
  mode?: string;
  acceptHeader?: string | null;
};

export function resolvePwaServiceWorkerCacheDecision(
  input: PwaServiceWorkerCacheDecisionInput
): PwaServiceWorkerCacheDecision {
  const url = typeof input.url === "string" ? new URL(input.url, input.origin) : input.url;

  if (input.method !== "GET") {
    return { strategy: "bypass" };
  }

  if (url.origin !== input.origin) {
    return { strategy: "bypass" };
  }

  if (
    shouldBypassPwaCache({
      pathname: url.pathname,
      mode: input.mode,
      acceptHeader: input.acceptHeader
    })
  ) {
    return { strategy: "bypass" };
  }

  if (isPwaCacheFirstAssetPath(url.pathname)) {
    return {
      strategy: "cache-first",
      cacheName: PWA_CACHE_NAMES.static
    };
  }

  if (isPwaNetworkFirstAssetPath(url.pathname)) {
    return {
      strategy: "network-first",
      cacheName: PWA_CACHE_NAMES.runtime
    };
  }

  return { strategy: "unmanaged" };
}

export function shouldBypassPwaCache(input: PwaCacheBypassInput): boolean {
  if (
    includesString(PWA_CACHE_BYPASS_EXACT_PATHS, input.pathname) ||
    PWA_CACHE_BYPASS_PATH_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))
  ) {
    return true;
  }

  if (input.mode === "navigate") {
    return true;
  }

  return (input.acceptHeader ?? "").includes(PWA_HTML_ACCEPT_HEADER_VALUE);
}

export function isPwaCacheFirstAssetPath(pathname: string): boolean {
  return includesString(PWA_CACHE_ALLOWLIST, pathname);
}

export function isPwaNetworkFirstAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith(PWA_NETWORK_FIRST_ASSET_PATH_PREFIX) &&
    PWA_NETWORK_FIRST_ASSET_EXTENSIONS.some((extension) => pathname.endsWith(extension))
  );
}

export function createPwaServiceWorkerSource(): string {
  return `
const STATIC_CACHE_NAME = ${JSON.stringify(PWA_CACHE_NAMES.static)};
const RUNTIME_CACHE_NAME = ${JSON.stringify(PWA_CACHE_NAMES.runtime)};
const CACHE_ALLOWLIST = ${JSON.stringify(PWA_CACHE_ALLOWLIST)};
const CACHE_BYPASS_EXACT_PATHS = ${JSON.stringify(PWA_CACHE_BYPASS_EXACT_PATHS)};
const CACHE_BYPASS_PATH_PREFIXES = ${JSON.stringify(PWA_CACHE_BYPASS_PATH_PREFIXES)};
const HTML_ACCEPT_HEADER_VALUE = ${JSON.stringify(PWA_HTML_ACCEPT_HEADER_VALUE)};
const NETWORK_FIRST_ASSET_PATH_PREFIX = ${JSON.stringify(PWA_NETWORK_FIRST_ASSET_PATH_PREFIX)};
const NETWORK_FIRST_ASSET_EXTENSIONS = ${JSON.stringify(PWA_NETWORK_FIRST_ASSET_EXTENSIONS)};
const CACHEABLE_STATIC_PATHS = new Set(CACHE_ALLOWLIST);
const MANAGED_CACHE_NAMES = new Set([STATIC_CACHE_NAME, RUNTIME_CACHE_NAME]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_ALLOWLIST))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("azure-ganttops-pwa-") && !MANAGED_CACHE_NAMES.has(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const decision = resolveCacheDecision(request, url);

  if (decision.strategy === "cache-first") {
    event.respondWith(cacheFirst(request, decision.cacheName));
    return;
  }

  if (decision.strategy === "network-first") {
    event.respondWith(networkFirst(request, decision.cacheName));
  }
});

function resolveCacheDecision(request, url) {
  if (request.method !== "GET") {
    return { strategy: "bypass" };
  }

  if (url.origin !== self.location.origin) {
    return { strategy: "bypass" };
  }

  if (shouldBypassCache(request, url)) {
    return { strategy: "bypass" };
  }

  if (CACHEABLE_STATIC_PATHS.has(url.pathname)) {
    return { strategy: "cache-first", cacheName: STATIC_CACHE_NAME };
  }

  if (isNetworkFirstAsset(url.pathname)) {
    return { strategy: "network-first", cacheName: RUNTIME_CACHE_NAME };
  }

  return { strategy: "unmanaged" };
}

function shouldBypassCache(request, url) {
  if (
    CACHE_BYPASS_EXACT_PATHS.includes(url.pathname) ||
    CACHE_BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return true;
  }

  if (request.mode === "navigate") {
    return true;
  }

  const acceptHeader = request.headers.get("accept") || "";
  return acceptHeader.includes(HTML_ACCEPT_HEADER_VALUE);
}

function isNetworkFirstAsset(pathname) {
  return (
    pathname.startsWith(NETWORK_FIRST_ASSET_PATH_PREFIX) &&
    NETWORK_FIRST_ASSET_EXTENSIONS.some((extension) => pathname.endsWith(extension))
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}
`.trimStart();
}

export const PWA_SERVICE_WORKER_SOURCE = createPwaServiceWorkerSource();

function includesString(values: readonly string[], value: string): boolean {
  return values.some((candidate) => candidate === value);
}
