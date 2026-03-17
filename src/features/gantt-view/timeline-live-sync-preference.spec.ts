// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearTimelineLiveSyncEnabledPreferenceForTests,
  hydrateTimelineLiveSyncEnabledPreference,
  loadTimelineLiveSyncEnabledPreference,
  saveTimelineLiveSyncEnabledPreference
} from "./timeline-live-sync-preference.js";

const fetchMock = vi.fn();

describe("timeline-live-sync-preference", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    clearTimelineLiveSyncEnabledPreferenceForTests();
  });

  it("defaults to enabled when no preference was persisted", () => {
    expect(loadTimelineLiveSyncEnabledPreference()).toBe(true);
  });

  it("persists and reloads the live sync toggle", () => {
    saveTimelineLiveSyncEnabledPreference(false);

    expect(loadTimelineLiveSyncEnabledPreference()).toBe(false);
    expect(globalThis.localStorage.getItem("azure-ganttops.timeline-live-sync-enabled")).toBe("false");
  });

  it("hydrates the toggle from server-backed user preferences", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        preferences: {
          timelineLiveSyncEnabled: false
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const hydrated = vi.fn();
    hydrateTimelineLiveSyncEnabledPreference(hydrated);

    await vi.waitFor(() => {
      expect(hydrated).toHaveBeenCalledWith(false);
    });

    expect(loadTimelineLiveSyncEnabledPreference()).toBe(false);
  });
});
