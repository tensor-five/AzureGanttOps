import { describe, expect, it } from "vitest";

import { deriveTimelineUiState } from "./timeline-trust-state.js";

describe("timeline trust state", () => {
  it("returns loading when request is in-flight", () => {
    expect(
      deriveTimelineUiState({
        isLoading: true,
        preflightStatus: "READY",
        hasTimeline: false,
        hasAnyItems: false,
        hydrationStatusCode: null,
        hasStrictFailFallback: false,
        hasQueryFailure: false
      })
    ).toBe("loading");
  });

  it("returns auth_failure when preflight is not READY", () => {
    expect(
      deriveTimelineUiState({
        preflightStatus: "SESSION_EXPIRED",
        hasTimeline: false,
        hasAnyItems: false,
        hydrationStatusCode: null,
        hasStrictFailFallback: false,
        hasQueryFailure: false
      })
    ).toBe("auth_failure");
  });

  it("returns ready_with_lkg_warning for strict-fail fallback", () => {
    expect(
      deriveTimelineUiState({
        preflightStatus: "READY",
        hasTimeline: true,
        hasAnyItems: true,
        hydrationStatusCode: null,
        hasStrictFailFallback: true,
        hasQueryFailure: true
      })
    ).toBe("ready_with_lkg_warning");
  });

  it("returns partial_failure for hydration partial results", () => {
    expect(
      deriveTimelineUiState({
        preflightStatus: "READY",
        hasTimeline: true,
        hasAnyItems: true,
        hydrationStatusCode: "HYDRATION_PARTIAL_FAILURE",
        hasStrictFailFallback: false,
        hasQueryFailure: false
      })
    ).toBe("partial_failure");
  });

  it("returns ready when timeline has items", () => {
    expect(
      deriveTimelineUiState({
        preflightStatus: "READY",
        hasTimeline: true,
        hasAnyItems: true,
        hydrationStatusCode: "OK",
        hasStrictFailFallback: false,
        hasQueryFailure: false
      })
    ).toBe("ready");
  });

  it("returns empty when timeline exists but has no items", () => {
    expect(
      deriveTimelineUiState({
        preflightStatus: "READY",
        hasTimeline: true,
        hasAnyItems: false,
        hydrationStatusCode: "OK",
        hasStrictFailFallback: false,
        hasQueryFailure: false
      })
    ).toBe("empty");
  });

  it("returns query_failure when runtime failed without fallback", () => {
    expect(
      deriveTimelineUiState({
        preflightStatus: "READY",
        hasTimeline: false,
        hasAnyItems: false,
        hydrationStatusCode: null,
        hasStrictFailFallback: false,
        hasQueryFailure: true
      })
    ).toBe("query_failure");
  });
});
