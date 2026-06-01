export type PerformanceLogFields = Record<string, string | number | boolean | null | undefined>;
type PerformanceLogFieldValue = string | number | boolean | null;

const PERF_LOG_ENV = "AZURE_GANTTOPS_PERF_LOGS";
const MAX_FIELD_LENGTH = 180;

export function isPerformanceLoggingEnabled(): boolean {
  return process.env[PERF_LOG_ENV] === "1";
}

export function writePerformanceLog(scope: string, event: string, fields?: PerformanceLogFields): void {
  if (!isPerformanceLoggingEnabled()) {
    return;
  }

  const suffix = formatPerformanceLogFields(fields);
  console.log(`${new Date().toISOString()} [ado-perf] ${scope}.${event}${suffix}`);
}

export function elapsedSince(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

export function formatPerformanceLogFields(fields?: PerformanceLogFields): string {
  if (!fields) {
    return "";
  }

  const serialized = Object.entries(fields)
    .filter((entry): entry is [string, PerformanceLogFieldValue] => typeof entry[1] !== "undefined")
    .map(([key, value]) => `${key}=${formatFieldValue(value)}`)
    .join(" ");

  return serialized.length > 0 ? ` ${serialized}` : "";
}

function formatFieldValue(value: PerformanceLogFieldValue): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const normalized = value.replace(/[\r\n\t]+/g, " ").trim();
  const clipped = normalized.length > MAX_FIELD_LENGTH ? `${normalized.slice(0, MAX_FIELD_LENGTH)}...` : normalized;

  return JSON.stringify(clipped);
}
