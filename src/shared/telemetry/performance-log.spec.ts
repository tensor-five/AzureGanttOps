import { afterEach, describe, expect, it, vi } from "vitest";

import { formatPerformanceLogFields, writePerformanceLog } from "./performance-log.js";

describe("performance-log", () => {
  const previousPerfLogs = process.env.AZURE_GANTTOPS_PERF_LOGS;

  afterEach(() => {
    if (typeof previousPerfLogs === "undefined") {
      delete process.env.AZURE_GANTTOPS_PERF_LOGS;
    } else {
      process.env.AZURE_GANTTOPS_PERF_LOGS = previousPerfLogs;
    }
    vi.restoreAllMocks();
  });

  it("formats fields without leaking multiline terminal output", () => {
    expect(formatPerformanceLogFields({
      durationMs: 42,
      queryId: "abc\n123",
      stale: false,
      skipped: undefined
    })).toBe(' durationMs=42 queryId="abc 123" stale=false');
  });

  it("writes timestamped perf logs only when enabled", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    process.env.AZURE_GANTTOPS_PERF_LOGS = "0";
    writePerformanceLog("query-intake", "start", { runVersion: 1 });
    expect(log).not.toHaveBeenCalled();

    process.env.AZURE_GANTTOPS_PERF_LOGS = "1";
    writePerformanceLog("query-intake", "start", { runVersion: 1 });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*\[ado-perf\] query-intake\.start runVersion=1$/
    );
  });
});
