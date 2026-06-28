import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch,
  type UserPreferences
} from "../../shared/user-preferences/user-preferences.client.js";

type UserPreferenceStoreConfig<T> = {
  storageKey: string;
  readFromServerCache: (preferences: UserPreferences, scopeKey: string | null) => unknown;
  sanitize: (value: unknown) => T | null;
  buildPatch: (value: T, cachedPreferences: UserPreferences, scopeKey: string | null) => Partial<UserPreferences>;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => unknown;
};

type UserPreferenceStoreScope = {
  scopeKey?: string | null;
};

type UserPreferenceStore<T> = {
  load: (scope?: UserPreferenceStoreScope) => T | null;
  save: (value: T, scope?: UserPreferenceStoreScope) => void;
  hydrate: (onHydrated?: (value: T) => void, scope?: UserPreferenceStoreScope) => void;
  clearForTests: () => void;
};

export function createUserPreferenceStore<T>(config: UserPreferenceStoreConfig<T>): UserPreferenceStore<T> {
  const memoryValues = new Map<string, T>();
  const hydratedScopes = new Set<string>();

  const serialize = config.serialize ?? ((value: T) => JSON.stringify(value));
  const deserialize = config.deserialize ?? ((raw: string) => JSON.parse(raw) as unknown);
  const storagePrefix = `${config.storageKey}::`;

  const normalizeScopeKey = (scope?: UserPreferenceStoreScope): string | null => {
    const raw = scope?.scopeKey;
    if (typeof raw !== "string") {
      return null;
    }

    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
  };

  const toMemoryScopeKey = (scopeKey: string | null): string => {
    return scopeKey ?? "__global__";
  };

  const resolveStorageKey = (scopeKey: string | null): string => {
    if (!scopeKey) {
      return config.storageKey;
    }

    return `${storagePrefix}${encodeURIComponent(scopeKey)}`;
  };

  const resolveLocalStorage = (): Storage | null => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    if (descriptor && "value" in descriptor) {
      return readStorage(descriptor.value);
    }

    if (typeof window === "undefined" || globalThis !== window) {
      return null;
    }

    try {
      return readStorage(window.localStorage);
    } catch {
      return null;
    }
  };

  const readFromLocalStorage = (scopeKey: string | null): T | null => {
    const storage = resolveLocalStorage();
    if (!storage) {
      return null;
    }

    try {
      const raw = storage.getItem(resolveStorageKey(scopeKey));
      if (!raw) {
        return null;
      }

      return config.sanitize(deserialize(raw));
    } catch {
      return null;
    }
  };

  const writeToLocalStorage = (value: T, scopeKey: string | null): void => {
    const storage = resolveLocalStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(resolveStorageKey(scopeKey), serialize(value));
    } catch {
      // localStorage unavailable or quota exceeded — skip silently
    }
  };

  const load = (scope?: UserPreferenceStoreScope): T | null => {
    const scopeKey = normalizeScopeKey(scope);
    const memoryScopeKey = toMemoryScopeKey(scopeKey);
    const fromStorage = readFromLocalStorage(scopeKey);
    if (fromStorage !== null) {
      memoryValues.set(memoryScopeKey, fromStorage);
      return fromStorage;
    }

    const fromCache = config.sanitize(config.readFromServerCache(getCachedUserPreferences(), scopeKey));
    if (fromCache !== null) {
      memoryValues.set(memoryScopeKey, fromCache);
      writeToLocalStorage(fromCache, scopeKey);
      return fromCache;
    }

    return memoryValues.get(memoryScopeKey) ?? null;
  };

  const save = (value: T, scope?: UserPreferenceStoreScope): void => {
    const scopeKey = normalizeScopeKey(scope);
    const memoryScopeKey = toMemoryScopeKey(scopeKey);
    const sanitized = config.sanitize(value);
    if (sanitized === null) {
      return;
    }

    memoryValues.set(memoryScopeKey, sanitized);
    writeToLocalStorage(sanitized, scopeKey);
    persistUserPreferencesPatch(config.buildPatch(sanitized, getCachedUserPreferences(), scopeKey));
  };

  const hydrate = (onHydrated?: (value: T) => void, scope?: UserPreferenceStoreScope): void => {
    const scopeKey = normalizeScopeKey(scope);
    const memoryScopeKey = toMemoryScopeKey(scopeKey);
    if (hydratedScopes.has(memoryScopeKey)) {
      return;
    }

    hydratedScopes.add(memoryScopeKey);
    void hydrateUserPreferences().then((preferences) => {
      const value = config.sanitize(config.readFromServerCache(preferences, scopeKey));
      if (value === null) {
        return;
      }

      memoryValues.set(memoryScopeKey, value);
      writeToLocalStorage(value, scopeKey);
      onHydrated?.(value);
    });
  };

  const clearForTests = (): void => {
    memoryValues.clear();
    hydratedScopes.clear();

    const storage = resolveLocalStorage();
    if (storage) {
      try {
        storage.removeItem(config.storageKey);
        const toRemove: string[] = [];
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key && key.startsWith(storagePrefix)) {
            toRemove.push(key);
          }
        }

        toRemove.forEach((key) => {
          storage.removeItem(key);
        });
      } catch {
        // localStorage unavailable — skip cleanup
      }
    }
  };

  return {
    load,
    save,
    hydrate,
    clearForTests
  };
}

function readStorage(value: unknown): Storage | null {
  const storage = value as Partial<Storage> | null | undefined;

  if (
    typeof storage?.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function" ||
    typeof storage.clear !== "function" ||
    typeof storage.key !== "function"
  ) {
    return null;
  }

  return storage as Storage;
}
