import { describe, expect, it } from "vitest";

import { buildQueryIntakeDiagnosticsEvent } from "./query-intake.controller.diagnostics.js";

describe("query-intake.controller.diagnostics", () => {
  it("builds diagnostics event payload with source and freshness mapping", () => {
    const event = buildQueryIntakeDiagnosticsEvent({
      statusCode: "OK",
      errorCode: null,
      guidance: "done",
      preflightStatus: "READY",
      uiState: "ready",
      trustState: "ready",
      activeQueryId: "q-1",
      selectedQueryId: "q-1",
      reloadSource: "full_reload",
      lastRefreshAt: "2026-03-11T00:00:00.000Z",
      lastSuccessfulRefreshAt: "2026-03-11T00:00:00.000Z",
      metadata: { runVersion: 2 }
    });

    expect(event.eventName).toBe("query-intake.outcome");
    expect(event.statusCode).toBe("OK");
    expect(event.source.activeQueryId).toBe("q-1");
    expect(event.freshness.lastRefreshAt).toBe("2026-03-11T00:00:00.000Z");
    expect(event.metadata).toEqual({ runVersion: 2 });
  });
});
