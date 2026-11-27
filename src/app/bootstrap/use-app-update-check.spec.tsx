// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppUpdateCheckResponse } from "../../shared/project-meta/app-update-check.js";
import { useAppUpdateCheck } from "./use-app-update-check.js";

describe("useAppUpdateCheck", () => {
  it("stores an update notice when a newer version is available", async () => {
    const checkAppUpdate = vi.fn(async () => updateAvailableResponse());
    const { result } = renderHook(() => useAppUpdateCheck({ checkAppUpdate }));

    act(() => {
      result.current.trigger();
    });

    await waitFor(() => {
      expect(result.current.updateNotice).toMatchObject({
        currentVersion: "1.8.3",
        latestVersion: "1.9.0",
        source: "github"
      });
    });
  });

  it("deduplicates parallel checks", async () => {
    const deferred = createDeferred<AppUpdateCheckResponse>();
    const checkAppUpdate = vi.fn(() => deferred.promise);
    const { result } = renderHook(() => useAppUpdateCheck({ checkAppUpdate }));

    act(() => {
      result.current.trigger();
      result.current.trigger();
    });

    await waitFor(() => {
      expect(checkAppUpdate).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      deferred.resolve(updateAvailableResponse());
      await deferred.promise;
    });
  });

  it("keeps an existing update notice when a later check is unavailable", async () => {
    const checkAppUpdate = vi
      .fn<() => Promise<AppUpdateCheckResponse>>()
      .mockResolvedValueOnce(updateAvailableResponse())
      .mockResolvedValueOnce({
        status: "unavailable",
        currentVersion: "1.8.3",
        checkedAt: "2026-06-27T10:01:00.000Z",
        source: "github",
        reason: "version_source_failed"
      });
    const { result } = renderHook(() => useAppUpdateCheck({ checkAppUpdate }));

    act(() => {
      result.current.trigger();
    });
    await waitFor(() => {
      expect(result.current.updateNotice?.latestVersion).toBe("1.9.0");
    });

    act(() => {
      result.current.trigger();
    });

    await waitFor(() => {
      expect(checkAppUpdate).toHaveBeenCalledTimes(2);
      expect(result.current.updateNotice?.latestVersion).toBe("1.9.0");
    });
  });

  it("clears an existing update notice only when the app is current", async () => {
    const checkAppUpdate = vi
      .fn<() => Promise<AppUpdateCheckResponse>>()
      .mockResolvedValueOnce(updateAvailableResponse())
      .mockResolvedValueOnce({
        status: "current",
        currentVersion: "1.9.0",
        latestVersion: "1.9.0",
        checkedAt: "2026-06-27T10:02:00.000Z",
        source: "github"
      });
    const { result } = renderHook(() => useAppUpdateCheck({ checkAppUpdate }));

    act(() => {
      result.current.trigger();
    });
    await waitFor(() => {
      expect(result.current.updateNotice).not.toBeNull();
    });

    act(() => {
      result.current.trigger();
    });

    await waitFor(() => {
      expect(result.current.updateNotice).toBeNull();
    });
  });

  it("keeps UI state quiet when the check throws", async () => {
    const checkAppUpdate = vi.fn(async () => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useAppUpdateCheck({ checkAppUpdate }));

    act(() => {
      result.current.trigger();
    });

    await waitFor(() => {
      expect(checkAppUpdate).toHaveBeenCalledTimes(1);
    });
    expect(result.current.updateNotice).toBeNull();
  });

  it("does not throw when the transport fails synchronously", async () => {
    const checkAppUpdate = vi.fn(() => {
      throw new Error("missing transport");
    });
    const { result } = renderHook(() => useAppUpdateCheck({ checkAppUpdate }));

    expect(() => {
      act(() => {
        result.current.trigger();
      });
    }).not.toThrow();

    await waitFor(() => {
      expect(checkAppUpdate).toHaveBeenCalledTimes(1);
    });
    expect(result.current.updateNotice).toBeNull();
  });
});

function updateAvailableResponse(): AppUpdateCheckResponse {
  return {
    status: "update_available",
    currentVersion: "1.8.3",
    latestVersion: "1.9.0",
    checkedAt: "2026-06-27T10:00:00.000Z",
    source: "github"
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return {
    promise,
    resolve
  };
}
