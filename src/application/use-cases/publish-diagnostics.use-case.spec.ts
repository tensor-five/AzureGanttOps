import { describe, expect, it, vi } from "vitest";

import type { DiagnosticsPort } from "../ports/diagnostics.port.js";
import { PublishDiagnosticsUseCase } from "./publish-diagnostics.use-case.js";

describe("PublishDiagnosticsUseCase", () => {
  it("publishes deterministic diagnostics payload for dual-surface use", async () => {
    const diagnostics: DiagnosticsPort = {
      publish: vi.fn(async () => undefined)
    };

    const useCase = new PublishDiagnosticsUseCase(diagnostics);

    await useCase.execute({
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

    expect(diagnostics.publish).toHaveBeenCalledTimes(1);
    expect(diagnostics.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: "QUERY_EXECUTION_FAILED",
        errorCode: "QUERY_EXECUTION_FAILED"
      })
    );
  });

  it("filters forbidden keys and redacts token-like string values", async () => {
    const diagnostics: DiagnosticsPort = {
      publish: vi.fn(async () => undefined)
    };

    const useCase = new PublishDiagnosticsUseCase(diagnostics);

    await useCase.execute({
      eventName: "query-intake.outcome",
      timestamp: "2026-03-05T22:50:43Z",
      statusCode: "UNKNOWN_ERROR",
      errorCode: "UNKNOWN_ERROR",
      guidance: "Bearer abc.def.ghi",
      source: {
        component: "query-intake",
        preflightStatus: "UNKNOWN_ERROR",
        uiState: "query_failure",
        trustState: "needs_attention",
        activeQueryId: null,
        selectedQueryId: null,
        reloadSource: null
      },
      freshness: {
        lastRefreshAt: null,
        lastSuccessfulRefreshAt: null
      },
      metadata: {
        durationMs: 42,
        accessToken: "secret-value",
        cliMessage: "ghp_sensitive_token"
      }
    });

    expect(diagnostics.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        guidance: "[REDACTED]",
        metadata: {
          durationMs: 42,
          cliMessage: "[REDACTED]"
        }
      })
    );
  });

  it("drops non-finite numeric metadata to keep payload serializable", async () => {
    const diagnostics: DiagnosticsPort = {
      publish: vi.fn(async () => undefined)
    };

    const useCase = new PublishDiagnosticsUseCase(diagnostics);

    await useCase.execute({
      eventName: "query-intake.outcome",
      timestamp: "2026-03-05T22:50:43Z",
      statusCode: "OK",
      errorCode: null,
      guidance: "Action: none",
      source: {
        component: "query-intake",
        preflightStatus: "READY",
        uiState: "ready",
        trustState: "ready",
        activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        reloadSource: "full_reload"
      },
      freshness: {
        lastRefreshAt: "2026-03-05T22:50:40.000Z",
        lastSuccessfulRefreshAt: "2026-03-05T22:50:40.000Z"
      },
      metadata: {
        finite: 7,
        notFinite: Number.POSITIVE_INFINITY
      }
    });

    expect(diagnostics.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          finite: 7
        }
      })
    );
  });
});
