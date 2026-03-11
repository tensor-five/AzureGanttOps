import type {
  DiagnosticsErrorCode,
  DiagnosticsEvent,
  DiagnosticsMetadataValue,
  DiagnosticsStatusCode
} from "../../application/dto/diagnostics/diagnostics-event.dto.js";
import type { QueryReloadSource } from "../../application/use-cases/run-query-intake.use-case.js";
import type { TimelineUiState } from "./timeline-trust-state.js";

export type QueryIntakeDiagnosticsInput = {
  statusCode: DiagnosticsStatusCode;
  errorCode: DiagnosticsErrorCode | null;
  guidance: string;
  preflightStatus: "READY" | "SESSION_EXPIRED" | "MISSING_EXTENSION" | "CONTEXT_MISMATCH" | "CLI_NOT_FOUND" | "UNKNOWN_ERROR";
  uiState: TimelineUiState;
  trustState: "ready" | "needs_attention" | "partial_failure";
  activeQueryId: string | null;
  selectedQueryId: string | null;
  reloadSource: QueryReloadSource | null;
  lastRefreshAt: string | null;
  lastSuccessfulRefreshAt: string | null;
  metadata?: Readonly<Record<string, DiagnosticsMetadataValue>>;
};

export function buildQueryIntakeDiagnosticsEvent(input: QueryIntakeDiagnosticsInput): DiagnosticsEvent {
  return {
    eventName: "query-intake.outcome",
    timestamp: new Date().toISOString(),
    statusCode: input.statusCode,
    errorCode: input.errorCode,
    guidance: input.guidance,
    source: {
      component: "query-intake",
      preflightStatus: input.preflightStatus,
      uiState: input.uiState,
      trustState: input.trustState,
      activeQueryId: input.activeQueryId,
      selectedQueryId: input.selectedQueryId,
      reloadSource: input.reloadSource
    },
    freshness: {
      lastRefreshAt: input.lastRefreshAt,
      lastSuccessfulRefreshAt: input.lastSuccessfulRefreshAt
    },
    metadata: input.metadata
  };
}
