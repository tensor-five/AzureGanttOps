// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearBrowserLocalConfigs } from "./local-config-browser-cleanup.js";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("clearBrowserLocalConfigs", () => {
  it("clears only AzureGanttOps storage keys, matching PWA caches and query client cache", async () => {
    localStorage.setItem("azure-ganttops.theme-mode.v1", "dark");
    localStorage.setItem("unrelated", "keep");
    sessionStorage.setItem("azure-ganttops.e2e.user-preferences", "{}");
    sessionStorage.setItem("other", "keep");
    const deletedCaches: string[] = [];
    const cacheStorage = {
      keys: vi.fn(async () => ["azure-ganttops-pwa-static-v1", "foreign-cache"]),
      delete: vi.fn(async (cacheName: string) => {
        deletedCaches.push(cacheName);
        return true;
      })
    } as unknown as CacheStorage;
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const report = await clearBrowserLocalConfigs({
      queryClient,
      localStorage,
      sessionStorage,
      cacheStorage
    });

    expect(report.status).toBe("completed");
    expect(localStorage.getItem("azure-ganttops.theme-mode.v1")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
    expect(sessionStorage.getItem("azure-ganttops.e2e.user-preferences")).toBeNull();
    expect(sessionStorage.getItem("other")).toBe("keep");
    expect(deletedCaches).toEqual(["azure-ganttops-pwa-static-v1"]);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(report.targets.map((target) => [target.target, target.status])).toEqual([
      ["browser-local-storage", "deleted"],
      ["browser-session-storage", "deleted"],
      ["browser-pwa-caches", "deleted"],
      ["browser-query-client-cache", "deleted"]
    ]);
  });

  it("reports skipped for absent targets and failed for cache errors", async () => {
    const cacheStorage = {
      keys: vi.fn(async () => {
        throw new Error("browser cache unavailable");
      })
    } as unknown as CacheStorage;

    const report = await clearBrowserLocalConfigs({
      queryClient: new QueryClient(),
      localStorage,
      sessionStorage,
      cacheStorage
    });

    expect(report.status).toBe("partial_failure");
    expect(report.targets.map((target) => [target.target, target.status, target.message])).toEqual([
      ["browser-local-storage", "skipped", "Local target was already absent."],
      ["browser-session-storage", "skipped", "Local target was already absent."],
      ["browser-pwa-caches", "failed", "Local target could not be cleared."],
      ["browser-query-client-cache", "deleted", "Local target cleared."]
    ]);
  });
});
