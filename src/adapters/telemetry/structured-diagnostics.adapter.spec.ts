import { describe, expect, it, vi } from "vitest";

import { StructuredDiagnosticsAdapter } from "./structured-diagnostics.adapter.js";

describe("StructuredDiagnosticsAdapter", () => {
  it("emits structured diagnostics JSON-safe envelope", async () => {
    const write = vi.fn();
    const adapter = new StructuredDiagnosticsAdapter(write);

    await adapter.publish({
      eventName: "query-intake.outcome",
      timestamp: "2026-03-05T22:50:43Z",
      statusCode: "QUERY_EXECUTION_FAILED",
      errorCode: "QUERY_EXECUTION_FAILED",
      guidance: "Query failed to run. Retry or verify query permissions.",
      source: {
        component: "query-intake",
        preflightStatus: "READY",
        uiState: "query_failure",
        trustState: "needs_attention",
        activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        reloadSource: "full_reload"
      },
      freshness: {
        lastRefreshAt: null,
        lastSuccessfulRefreshAt: "2026-03-05T22:45:00.000Z"
      },
      metadata: {
        runVersion: 2,
        strictFailActive: false
      }
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({
      event: "diagnostics",
      timestamp: "2026-03-05T22:50:43Z",
      name: "query-intake.outcome",
      statusCode: "QUERY_EXECUTION_FAILED",
      errorCode: "QUERY_EXECUTION_FAILED",
      guidance: "Query failed to run. Retry or verify query permissions.",
      source: {
        component: "query-intake",
        preflightStatus: "READY",
        uiState: "query_failure",
        trustState: "needs_attention",
        activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        reloadSource: "full_reload"
      },
      freshness: {
        lastRefreshAt: null,
        lastSuccessfulRefreshAt: "2026-03-05T22:45:00.000Z"
      },
      metadata: {
        runVersion: 2,
        strictFailActive: false
      }
    });
  });
});
