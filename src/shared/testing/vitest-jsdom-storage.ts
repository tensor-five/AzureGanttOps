type StorageKey = "localStorage" | "sessionStorage";
type StorageTarget = Window | typeof globalThis;
const STORAGE_PROBE_KEY = "__azure_ganttops_vitest_storage_probe__";

export function installUsableJsdomStorage(): void {
  const jsdomWindow = resolveJsdomWindow();
  if (!jsdomWindow) {
    return;
  }

  installUsableStorage(jsdomWindow, "localStorage");
  installUsableStorage(jsdomWindow, "sessionStorage");
}

function resolveJsdomWindow(): Window | null {
  const vitestJsdomWindow = resolveVitestJsdomWindow();
  if (vitestJsdomWindow) {
    return vitestJsdomWindow;
  }

  if (typeof window === "undefined" || typeof window.document === "undefined") {
    return null;
  }

  return window;
}

function resolveVitestJsdomWindow(): Window | null {
  const jsdomInstance = (globalThis as { jsdom?: { window?: unknown } }).jsdom;
  if (!jsdomInstance || !isWindowLike(jsdomInstance.window)) {
    return null;
  }

  return jsdomInstance.window;
}

function isWindowLike(value: unknown): value is Window {
  return typeof value === "object" && value !== null && "document" in value;
}

function installUsableStorage(jsdomWindow: Window, key: StorageKey): void {
  const existingStorage = readUsableStorage(jsdomWindow, key);
  if (existingStorage) {
    if ((globalThis as unknown) !== (jsdomWindow as unknown)) {
      defineStorage(globalThis, key, existingStorage);
    }
    return;
  }

  const fallbackStorage = createMemoryStorage();
  defineStorage(jsdomWindow, key, fallbackStorage);
  defineStorage(globalThis, key, fallbackStorage);
}

function defineStorage(target: StorageTarget, key: StorageKey, storage: Storage): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor && "value" in descriptor && descriptor.value === storage) {
    return;
  }
  if (descriptor && descriptor.configurable === false) {
    return;
  }

  try {
    Object.defineProperty(target, key, {
      configurable: true,
      value: storage,
      writable: true
    });
  } catch {
    // Some runtimes expose storage as a non-overridable host accessor. Tests that
    // need storage will still use the jsdom window value installed above.
  }
}

function readUsableStorage(jsdomWindow: Window, key: StorageKey): Storage | null {
  let storage: Storage;
  try {
    storage = jsdomWindow[key];
  } catch {
    return null;
  }

  if (!isStorageLike(storage)) {
    return null;
  }

  let previousValue: string | null = null;
  let shouldRestore = false;
  try {
    previousValue = storage.getItem(STORAGE_PROBE_KEY);
    shouldRestore = true;
    storage.setItem(STORAGE_PROBE_KEY, "ok");
    return storage.getItem(STORAGE_PROBE_KEY) === "ok" ? storage : null;
  } catch {
    return null;
  } finally {
    if (shouldRestore) {
      restoreProbeValue(storage, previousValue);
    }
  }
}

function isStorageLike(value: unknown): value is Storage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Storage).getItem === "function" &&
    typeof (value as Storage).setItem === "function" &&
    typeof (value as Storage).removeItem === "function"
  );
}

function restoreProbeValue(storage: Storage, previousValue: string | null): void {
  try {
    if (previousValue === null) {
      storage.removeItem(STORAGE_PROBE_KEY);
      return;
    }

    storage.setItem(STORAGE_PROBE_KEY, previousValue);
  } catch {
    // A failed probe already made this storage unusable for the setup path.
  }
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(String(key)) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(String(key));
    },
    setItem(key: string, value: string) {
      values.set(String(key), String(value));
    }
  };
}

installUsableJsdomStorage();
