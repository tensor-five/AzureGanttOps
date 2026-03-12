import { describe, expect, it } from "vitest";

import {
  buildCapabilities,
  deriveDiagnosticsStatusCodeFromResult,
  guidanceForRuntimeError,
  noStrictFailState,
  strictFailMessage,
  toDiagnosticsErrorCode,
  toDiagnosticsStatusCode,
  toTrustState
} from "./query-intake.controller.mappers.js";

describe("query-intake.controller.mappers", () => {
  it("maps known and unknown diagnostics codes deterministically", () => {
    expect(toDiagnosticsStatusCode("MAP_VALIDATION_FAILED")).toBe("MAP_VALIDATION_FAILED");
    expect(toDiagnosticsStatusCode("QUERY_EXECUTION_FAILED_HTTP_401_UNAUTHORIZED")).toBe("QUERY_EXECUTION_FAILED");
    expect(toDiagnosticsStatusCode("SOMETHING_NEW")).toBe("UNKNOWN_ERROR");
    expect(toDiagnosticsErrorCode("OK")).toBeNull();
    expect(toDiagnosticsErrorCode("QUERY_EXECUTION_FAILED")).toBe("QUERY_EXECUTION_FAILED");
  });

  it("derives status code with strict fallback and partial hydration precedence", () => {
    expect(
      deriveDiagnosticsStatusCodeFromResult({
        preflightStatus: "READY",
        strictFailActive: true,
        reloadSource: "full_reload",
        failureCode: null,
        uiState: "partial_failure"
      })
    ).toBe("STRICT_FAIL_FALLBACK");

    expect(
      deriveDiagnosticsStatusCodeFromResult({
        preflightStatus: "READY",
        strictFailActive: false,
        reloadSource: "full_reload",
        failureCode: null,
        uiState: "partial_failure"
      })
    ).toBe("HYDRATION_PARTIAL_FAILURE");
  });

  it("returns unchanged runtime guidance and trust/capability defaults", () => {
    expect(guidanceForRuntimeError(new Error("QRY_SHAPE_UNSUPPORTED"))).toBe(
      "Only flat queries are supported in this phase. Use a flat query and retry."
    );
    expect(toTrustState("ready")).toBe("ready");
    expect(toTrustState("auth_failure")).toBe("needs_attention");
    expect(buildCapabilities("READY")).toMatchObject({
      canRefresh: true,
      canSwitchQuery: true,
      canChangeDensity: true,
      canOpenDetails: true,
      readOnlyTimeline: true
    });
  });

  it("builds strict fail payload text without behavioral drift", () => {
    expect(noStrictFailState(undefined)).toEqual({
      active: false,
      message: null,
      retryActionLabel: null,
      dismissible: true,
      dismissed: false,
      lastSuccessfulRefreshAt: null,
      lastSuccessfulSource: null
    });
    expect(strictFailMessage("QUERY_EXECUTION_FAILED", "2026-03-10T10:00:00.000Z")).toBe(
      "Refresh failed (QUERY_EXECUTION_FAILED). Showing last successful timeline from 2026-03-10T10:00:00.000Z. Retry now."
    );
  });
});
