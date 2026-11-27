import { describe, expect, it } from "vitest";

import {
  PWA_CACHE_NAMES,
  PWA_ICON_192_PATH,
  PWA_ICON_512_PATH,
  PWA_MANIFEST_PATH
} from "./pwa-constants.js";
import {
  PWA_SERVICE_WORKER_SOURCE,
  createPwaServiceWorkerSource,
  resolvePwaServiceWorkerCacheDecision
} from "./pwa-service-worker.js";

const SAME_ORIGIN = "http://127.0.0.1:4173";

describe("pwa service worker cache policy", () => {
  it.each([
    {
      name: "POST requests",
      input: { method: "POST", path: "/dist/src/app/bootstrap/local-ui-entry.browser.js" }
    },
    {
      name: "cross-origin GET requests",
      input: { method: "GET", absoluteUrl: "https://cdn.example.invalid/dist/app.js" }
    },
    {
      name: "root HTML shell",
      input: { method: "GET", path: "/" }
    },
    {
      name: "navigation requests",
      input: { method: "GET", path: "/dist/src/app/bootstrap/local-ui-entry.browser.js", mode: "navigate" }
    },
    {
      name: "requests accepting HTML",
      input: {
        method: "GET",
        path: "/dist/src/app/bootstrap/local-ui-entry.browser.js",
        acceptHeader: "text/html,application/xhtml+xml"
      }
    },
    {
      name: "phase2 API requests",
      input: { method: "GET", path: "/phase2/query-intake" }
    },
    {
      name: "user preference API requests",
      input: { method: "GET", path: "/phase2/user-preferences" }
    }
  ])("bypasses $name", ({ input }) => {
    expect(decide(input)).toEqual({ strategy: "bypass" });
  });

  it.each([PWA_MANIFEST_PATH, PWA_ICON_192_PATH, PWA_ICON_512_PATH])(
    "uses cache-first for install asset %s",
    (path) => {
      expect(decide({ method: "GET", path })).toEqual({
        strategy: "cache-first",
        cacheName: PWA_CACHE_NAMES.static
      });
    }
  );

  it.each([
    "/dist/src/app/bootstrap/local-ui-entry.browser.js",
    "/dist/src/app/bootstrap/local-ui-entry.browser.css"
  ])("uses network-first for built UI asset %s", (path) => {
    expect(decide({ method: "GET", path })).toEqual({
      strategy: "network-first",
      cacheName: PWA_CACHE_NAMES.runtime
    });
  });

  it.each(["/favicon.svg", "/health", "/dist/src/app/bootstrap/local-ui-entry.browser.map"])(
    "leaves same-origin GET %s unmanaged",
    (path) => {
      expect(decide({ method: "GET", path })).toEqual({ strategy: "unmanaged" });
    }
  );

  it("exports the generated service worker source", () => {
    expect(PWA_SERVICE_WORKER_SOURCE).toBe(createPwaServiceWorkerSource());
  });
});

function decide(input: {
  method: string;
  path?: string;
  absoluteUrl?: string;
  mode?: string;
  acceptHeader?: string;
}) {
  return resolvePwaServiceWorkerCacheDecision({
    method: input.method,
    url: input.absoluteUrl ?? `${SAME_ORIGIN}${input.path ?? "/"}`,
    origin: SAME_ORIGIN,
    mode: input.mode,
    acceptHeader: input.acceptHeader
  });
}
