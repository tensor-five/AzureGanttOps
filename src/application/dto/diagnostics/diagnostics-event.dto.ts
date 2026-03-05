export type DiagnosticsStatusCode =
  | "OK"
  | "SESSION_EXPIRED"
  | "MISSING_EXTENSION"
  | "CONTEXT_MISMATCH"
  | "CLI_NOT_FOUND"
  | "UNKNOWN_ERROR"
  | "QUERY_NOT_FOUND"
  | "QUERY_EXECUTION_FAILED"
  | "QRY_SHAPE_UNSUPPORTED"
  | "HYDRATION_TRANSIENT_RETRY_EXHAUSTED"
  | "HYDRATION_PARTIAL_FAILURE"
  | "MAP_PROFILE_NOT_FOUND"
  | "MAP_VALIDATION_FAILED"
  | "CONTEXT_REQUIRED"
  | "MALFORMED_PAYLOAD"
  | "STALE_DISCARDED"
  | "STRICT_FAIL_FALLBACK";

export type DiagnosticsErrorCode = Exclude<DiagnosticsStatusCode, "OK">;

export type DiagnosticsSourceContext = {
  component: "query-intake";
  preflightStatus: "READY" | "SESSION_EXPIRED" | "MISSING_EXTENSION" | "CONTEXT_MISMATCH" | "CLI_NOT_FOUND" | "UNKNOWN_ERROR";
  uiState:
    | "loading"
    | "empty"
    | "auth_failure"
    | "query_failure"
    | "partial_failure"
    | "ready"
    | "ready_with_lkg_warning";
  trustState: "ready" | "needs_attention" | "partial_failure";
  activeQueryId: string | null;
  selectedQueryId: string | null;
  reloadSource: "full_reload" | "preflight_blocked" | "stale_discarded" | null;
};

export type DiagnosticsFreshnessMetadata = {
  lastRefreshAt: string | null;
  lastSuccessfulRefreshAt: string | null;
};

export type DiagnosticsMetadataValue = string | number | boolean | null;

export type DiagnosticsEvent = {
  eventName: "query-intake.outcome";
  timestamp: string;
  statusCode: DiagnosticsStatusCode;
  errorCode: DiagnosticsErrorCode | null;
  guidance: string;
  source: DiagnosticsSourceContext;
  freshness: DiagnosticsFreshnessMetadata;
  metadata?: Readonly<Record<string, DiagnosticsMetadataValue>>;
};
