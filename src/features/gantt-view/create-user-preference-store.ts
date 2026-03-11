import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch,
  type UserPreferences
} from "../../shared/user-preferences/user-preferences.client.js";

type UserPreferenceStoreConfig<T> = {
  storageKey: string;
  readFromServerCache: (preferences: UserPreferences) => unknown;
  sanitize: (value: unknown) => T | null;
  buildPatch: (value: T, cachedPreferences: UserPreferences) => Partial<UserPreferences>;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => unknown;
};

type UserPreferenceStore<T> = {
  load: () => T | null;
  save: (value: T) => void;
  hydrate: (onHydrated?: (value: T) => void) => void;
  clearForTests: () => void;
};

export function createUserPreferenceStore<T>(config: UserPreferenceStoreConfig<T>): UserPreferenceStore<T> {
  let memoryValue: T | null = null;
  let hydrationStarted = false;

  const serialize = config.serialize ?? ((value: T) => JSON.stringify(value));
  const deserialize = config.deserialize ?? ((raw: string) => JSON.parse(raw) as unknown);

  const readFromLocalStorage = (): T | null => {
    if (typeof globalThis.localStorage === "undefined") {
      return null;
    }

    const raw = globalThis.localStorage.getItem(config.storageKey);
    if (!raw) {
      return null;
    }

    try {
      return config.sanitize(deserialize(raw));
    } catch {
      return null;
    }
  };

  const writeToLocalStorage = (value: T): void => {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }

    globalThis.localStorage.setItem(config.storageKey, serialize(value));
  };

  const load = (): T | null => {
    const fromStorage = readFromLocalStorage();
    if (fromStorage !== null) {
      memoryValue = fromStorage;
      return fromStorage;
    }

    const fromCache = config.sanitize(config.readFromServerCache(getCachedUserPreferences()));
    if (fromCache !== null) {
      memoryValue = fromCache;
      writeToLocalStorage(fromCache);
      return fromCache;
    }

    return memoryValue;
  };

  const save = (value: T): void => {
    const sanitized = config.sanitize(value);
    if (sanitized === null) {
      return;
    }

    memoryValue = sanitized;
    writeToLocalStorage(sanitized);
    persistUserPreferencesPatch(config.buildPatch(sanitized, getCachedUserPreferences()));
  };

  const hydrate = (onHydrated?: (value: T) => void): void => {
    if (hydrationStarted) {
      return;
    }

    hydrationStarted = true;
    void hydrateUserPreferences().then((preferences) => {
      const value = config.sanitize(config.readFromServerCache(preferences));
      if (value === null) {
        return;
      }

      memoryValue = value;
      writeToLocalStorage(value);
      onHydrated?.(value);
    });
  };

  const clearForTests = (): void => {
    memoryValue = null;
    hydrationStarted = false;

    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.removeItem(config.storageKey);
    }
  };

  return {
    load,
    save,
    hydrate,
    clearForTests
  };
}
