// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { PWA_SERVICE_WORKER_PATH } from "./pwa-constants.js";
import { registerServiceWorker } from "./register-service-worker.js";

describe("registerServiceWorker", () => {
  it("returns null when service workers are unavailable", async () => {
    await expect(registerServiceWorker({ navigatorRef: {} })).resolves.toBeNull();
  });

  it("registers the local service worker with root scope", async () => {
    const registration = {} as ServiceWorkerRegistration;
    const register = vi.fn(async () => registration);

    await expect(
      registerServiceWorker({
        navigatorRef: {
          serviceWorker: {
            register
          }
        }
      })
    ).resolves.toBe(registration);

    expect(register).toHaveBeenCalledWith(PWA_SERVICE_WORKER_PATH, { scope: "/" });
  });

  it("catches registration failures and reports them", async () => {
    const error = new Error("registration failed");
    const onError = vi.fn();

    await expect(
      registerServiceWorker({
        navigatorRef: {
          serviceWorker: {
            register: vi.fn(async () => {
              throw error;
            })
          }
        },
        onError
      })
    ).resolves.toBeNull();

    expect(onError).toHaveBeenCalledWith(error);
  });
});
