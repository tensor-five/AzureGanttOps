import type { QueryClient } from "@tanstack/react-query";

import type {
  LocalConfigResetReport,
  LocalConfigResetTargetResult
} from "../../application/ports/local-config-reset.port.js";

const BROWSER_STORAGE_PREFIX = "azure-ganttops.";
const PWA_CACHE_PREFIX = "azure-ganttops-pwa-";

export async function clearBrowserLocalConfigs(params: {
  queryClient: QueryClient;
  localStorage?: Storage;
  sessionStorage?: Storage;
  cacheStorage?: CacheStorage;
}): Promise<LocalConfigResetReport> {
  const localStorageResult = clearStorageByPrefix({
    target: "browser-local-storage",
    label: "Browser localStorage app keys",
    storage: params.localStorage ?? readStorage("localStorage"),
    prefix: BROWSER_STORAGE_PREFIX
  });
  const sessionStorageResult = clearStorageByPrefix({
    target: "browser-session-storage",
    label: "Browser sessionStorage app keys",
    storage: params.sessionStorage ?? readStorage("sessionStorage"),
    prefix: BROWSER_STORAGE_PREFIX
  });
  const cacheStorageResult = await clearCachesByPrefix({
    target: "browser-pwa-caches",
    label: "Browser PWA caches",
    cacheStorage: params.cacheStorage ?? readCacheStorage(),
    prefix: PWA_CACHE_PREFIX
  });
  const queryClientResult = clearQueryClient(params.queryClient);
  const targets = [
    localStorageResult,
    sessionStorageResult,
    cacheStorageResult,
    queryClientResult
  ];

  return {
    status: targets.some((target) => target.status === "failed") ? "partial_failure" : "completed",
    targets
  };
}

function clearStorageByPrefix(params: {
  target: string;
  label: string;
  storage: Storage | null;
  prefix: string;
}): LocalConfigResetTargetResult {
  if (!params.storage) {
    return skipped(params.target, params.label);
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < params.storage.length; index += 1) {
      const key = params.storage.key(index);
      if (key?.startsWith(params.prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      params.storage?.removeItem(key);
    });

    return keysToRemove.length > 0 ? deleted(params.target, params.label) : skipped(params.target, params.label);
  } catch {
    return failed(params.target, params.label);
  }
}

async function clearCachesByPrefix(params: {
  target: string;
  label: string;
  cacheStorage: CacheStorage | null;
  prefix: string;
}): Promise<LocalConfigResetTargetResult> {
  if (!params.cacheStorage) {
    return skipped(params.target, params.label);
  }

  try {
    const cacheNames = await params.cacheStorage.keys();
    const matchingCacheNames = cacheNames.filter((cacheName) => cacheName.startsWith(params.prefix));
    await Promise.all(matchingCacheNames.map((cacheName) => params.cacheStorage!.delete(cacheName)));
    return matchingCacheNames.length > 0 ? deleted(params.target, params.label) : skipped(params.target, params.label);
  } catch {
    return failed(params.target, params.label);
  }
}

function clearQueryClient(queryClient: QueryClient): LocalConfigResetTargetResult {
  try {
    queryClient.clear();
    return deleted("browser-query-client-cache", "Browser query client cache");
  } catch {
    return failed("browser-query-client-cache", "Browser query client cache");
  }
}

function readStorage(name: "localStorage" | "sessionStorage"): Storage | null {
  try {
    if (typeof globalThis[name] === "undefined") {
      return null;
    }

    return globalThis[name];
  } catch {
    return null;
  }
}

function readCacheStorage(): CacheStorage | null {
  try {
    if (typeof globalThis.caches === "undefined") {
      return null;
    }

    return globalThis.caches;
  } catch {
    return null;
  }
}

function deleted(target: string, label: string): LocalConfigResetTargetResult {
  return {
    target,
    label,
    status: "deleted",
    message: "Local target cleared."
  };
}

function skipped(target: string, label: string): LocalConfigResetTargetResult {
  return {
    target,
    label,
    status: "skipped",
    message: "Local target was already absent."
  };
}

function failed(target: string, label: string): LocalConfigResetTargetResult {
  return {
    target,
    label,
    status: "failed",
    message: "Local target could not be cleared."
  };
}
