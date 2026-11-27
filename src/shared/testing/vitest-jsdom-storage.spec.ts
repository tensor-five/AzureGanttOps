// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { installUsableJsdomStorage } from "./vitest-jsdom-storage.js";

type StorageKey = "localStorage" | "sessionStorage";
const STORAGE_KEYS = ["localStorage", "sessionStorage"] as const satisfies readonly StorageKey[];

describe("installUsableJsdomStorage", () => {
  it("keeps usable jsdom window storage and exposes it globally without reading global accessors", () => {
    const jsdomWindow = resolveVitestJsdomWindow();
    const sameWindowGlobal = (globalThis as unknown) === (jsdomWindow as unknown);
    const originalDescriptors = captureStorageDescriptors(jsdomWindow);
    const jsdomStorages = captureWindowStorages(jsdomWindow);
    const globalGetterReads: Record<StorageKey, number> = {
      localStorage: 0,
      sessionStorage: 0
    };

    try {
      if (!sameWindowGlobal) {
        for (const key of STORAGE_KEYS) {
          Object.defineProperty(globalThis, key, {
            configurable: true,
            get() {
              globalGetterReads[key] += 1;
              return jsdomStorages[key];
            }
          });
        }
      }

      installUsableJsdomStorage();

      for (const key of STORAGE_KEYS) {
        expect(globalGetterReads[key]).toBe(0);
        expect(Object.getOwnPropertyDescriptor(jsdomWindow, key)).toEqual(originalDescriptors.window[key]);
        expect(jsdomWindow[key]).toBe(jsdomStorages[key]);
        expect(globalThis[key]).toBe(jsdomStorages[key]);

        const probeKey = `azure-ganttops.${key}.storage-check`;
        jsdomWindow[key].setItem(probeKey, "ok");
        expect(globalThis[key].getItem(probeKey)).toBe("ok");
        jsdomWindow[key].removeItem(probeKey);
      }
    } finally {
      restoreStorageDescriptors(jsdomWindow, originalDescriptors, sameWindowGlobal);
    }
  });
});

function resolveVitestJsdomWindow(): Window {
  const jsdomWindow = (globalThis as { jsdom?: { window?: Window } }).jsdom?.window;
  if (!jsdomWindow) {
    throw new Error("Expected Vitest jsdom environment to expose the backing jsdom window.");
  }

  return jsdomWindow;
}

function captureStorageDescriptors(jsdomWindow: Window): {
  global: Record<StorageKey, PropertyDescriptor | undefined>;
  window: Record<StorageKey, PropertyDescriptor | undefined>;
} {
  return {
    global: {
      localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
      sessionStorage: Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
    },
    window: {
      localStorage: Object.getOwnPropertyDescriptor(jsdomWindow, "localStorage"),
      sessionStorage: Object.getOwnPropertyDescriptor(jsdomWindow, "sessionStorage")
    }
  };
}

function captureWindowStorages(jsdomWindow: Window): Record<StorageKey, Storage> {
  return {
    localStorage: jsdomWindow.localStorage,
    sessionStorage: jsdomWindow.sessionStorage
  };
}

function restoreStorageDescriptors(
  jsdomWindow: Window,
  descriptors: {
    global: Record<StorageKey, PropertyDescriptor | undefined>;
    window: Record<StorageKey, PropertyDescriptor | undefined>;
  },
  sameWindowGlobal: boolean
): void {
  for (const key of STORAGE_KEYS) {
    restoreDescriptor(jsdomWindow, key, descriptors.window[key]);
    if (!sameWindowGlobal) {
      restoreDescriptor(globalThis, key, descriptors.global[key]);
    }
  }
}

function restoreDescriptor(target: Window | typeof globalThis, key: StorageKey, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  delete (target as Record<StorageKey, Storage | undefined>)[key];
}
