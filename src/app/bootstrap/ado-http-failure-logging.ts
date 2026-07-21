export type AdoHttpFailureLogWriter = (payload: AdoHttpFailureLogPayload) => void;

export type AdoHttpFailureLogPayload = {
  event: "ado-http.failure";
  timestamp: string;
  failureType: "response" | "transport";
  method: "GET" | "PATCH" | "POST";
  url: string;
  status: number | null;
  durationMs: number;
  requestId: {
    header: string;
    value: string;
  } | null;
  jsonPatch: {
    operationCount: number;
    operations: Array<{
      op: string;
      path: string;
      value?: string | number;
    }>;
  } | null;
  responsePreview: string;
};

type AdoHttpFailureLogInput = {
  timestamp: string;
  failureType: "response" | "transport";
  method: "GET" | "PATCH" | "POST";
  url: string;
  status: number | null;
  durationMs: number;
  requestBody?: unknown;
  responseHeaders?: Record<string, string | undefined>;
  responsePreview: string;
};

const REQUEST_ID_HEADER_PRIORITY = [
  "x-vss-e2eid",
  "x-vss-requestid",
  "activityid",
  "x-tfs-session",
  "x-ms-request-id",
  "request-id"
] as const;
const SAFE_PATCH_VALUE_PATHS = new Set(["/rev", "/fields/System.State"]);
const LOG_PREFIX = "[ado-runtime]";

export function writeAdoHttpFailureLog(
  input: AdoHttpFailureLogInput,
  writer: AdoHttpFailureLogWriter = defaultWriter
): void {
  const payload: AdoHttpFailureLogPayload = {
    event: "ado-http.failure",
    timestamp: input.timestamp,
    failureType: input.failureType,
    method: input.method,
    url: input.url,
    status: input.status,
    durationMs: input.durationMs,
    requestId: resolveRequestId(input.responseHeaders),
    jsonPatch: summarizeJsonPatch(input.requestBody),
    responsePreview: input.responsePreview
  };

  try {
    writer(payload);
  } catch {
    // Diagnostics must never change the outcome of the observed ADO request.
  }
}

function summarizeJsonPatch(requestBody: unknown): AdoHttpFailureLogPayload["jsonPatch"] {
  if (!Array.isArray(requestBody)) {
    return null;
  }

  return {
    operationCount: requestBody.length,
    operations: requestBody.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const record = entry as Record<string, unknown>;
      if (typeof record.op !== "string" || typeof record.path !== "string") {
        return [];
      }

      const value = resolveSafePatchValue(record.path, record.value);
      return [
        {
          op: record.op,
          path: record.path,
          ...(value !== undefined ? { value } : {})
        }
      ];
    })
  };
}

function resolveSafePatchValue(path: string, value: unknown): string | number | undefined {
  if (!SAFE_PATCH_VALUE_PATHS.has(path)) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 100 ? `${normalized.slice(0, 97)}...` : normalized;
  }

  return undefined;
}

function resolveRequestId(
  headers: Record<string, string | undefined> | undefined
): AdoHttpFailureLogPayload["requestId"] {
  if (!headers) {
    return null;
  }

  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value] as const)
  );

  for (const header of REQUEST_ID_HEADER_PRIORITY) {
    const value = normalizedHeaders.get(header)?.trim();
    if (value) {
      return {
        header,
        value
      };
    }
  }

  return null;
}

function defaultWriter(payload: AdoHttpFailureLogPayload): void {
  console.error(`${LOG_PREFIX} ${JSON.stringify(payload)}`);
}
