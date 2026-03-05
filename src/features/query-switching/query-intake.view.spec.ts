import { describe, expect, it } from "vitest";

import { renderQueryIntakeView } from "./query-intake.view.js";

describe("query-intake view", () => {
  it("renders locked title+state timeline, details IDs, and dependency toggle semantics", () => {
    const view = renderQueryIntakeView({
      success: true,
      guidance: null,
      flatQuerySupportNote: "Phase 2 note: only flat queries are supported.",
      activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
      lastRefreshAt: "2026-03-04T20:00:00.000Z",
      reloadSource: "full_reload",
      trustState: "ready",
      strictFail: {
        active: false,
        message: null,
        retryActionLabel: null,
        dismissible: true,
        dismissed: false,
        lastSuccessfulRefreshAt: null,
        lastSuccessfulSource: null
      },
      selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
      savedQueries: [
        {
          id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          name: "Delivery Timeline",
          path: "Shared Queries/Delivery Timeline"
        }
      ],
      mappingValidation: {
        status: "valid",
        issues: []
      },
      timeline: {
        bars: [
          {
            workItemId: 101,
            title: "Alpha delivery outcome title that is intentionally very long for ellipsis coverage",
            state: {
              code: "Active",
              badge: "A",
              color: "#1d4ed8"
            },
            schedule: {
              startDate: "2026-03-01T00:00:00.000Z",
              endDate: "2026-03-03T00:00:00.000Z",
              missingBoundary: null
            },
            details: {
              mappedId: "WI-101"
            }
          },
          {
            workItemId: 202,
            title: "Beta",
            state: {
              code: "New",
              badge: "N",
              color: "#7c3aed"
            },
            schedule: {
              startDate: null,
              endDate: "2026-03-05T00:00:00.000Z",
              missingBoundary: "start"
            },
            details: {
              mappedId: "WI-202"
            }
          }
        ],
        unschedulable: [
          {
            workItemId: 303,
            title: "Gamma",
            state: {
              code: "Closed",
              badge: "C",
              color: "#6b7280"
            },
            details: {
              mappedId: "WI-303"
            },
            reason: "missing-both-dates"
          }
        ],
        dependencies: [
          {
            predecessorWorkItemId: 101,
            successorWorkItemId: 202,
            dependencyType: "FS",
            label: "#101 [end] -> #202 [start]"
          }
        ],
        suppressedDependencies: [
          {
            predecessorWorkItemId: 202,
            successorWorkItemId: 303,
            dependencyType: "FS",
            reason: "unschedulable-endpoint"
          }
        ],
        mappingValidation: {
          status: "valid",
          issues: []
        }
      },
      showDependencies: true
    });

    expect(view).toContain("[OK] Ready");
    expect(view).toContain("Trust state: ready");
    expect(view).toContain("Phase 2 note: only flat queries are supported.");
    expect(view).toContain("Active query source: 37f6f880-0b7b-4350-9f97-7263b40d4e95");
    expect(view).toContain("Last refresh: 2026-03-04T20:00:00.000Z");
    expect(view).toContain("Reload source: full_reload");
    expect(view).toContain("Timeline bars (title + state):");
    expect(view).toContain("#WI-101");
    expect(view).toContain("[A|#1d4ed8]");
    expect(view).toContain("[N|#7c3aed] [half-open:start]");
    expect(view).toContain("…");
    expect(view).toContain("Unschedulable items (title + state):");
    expect(view).toContain("- Gamma [C|#6b7280]");
    expect(view).not.toContain("- #303 [C|#6b7280]");
    expect(view).toContain("Timeline details (mapped ID):");
    expect(view).toContain("#101 mappedId=WI-101");
    expect(view).toContain("Unschedulable details (mapped ID):");
    expect(view).toContain("#303 mappedId=WI-303");
    expect(view).toContain("Dependency arrows: shown");
    expect(view).toContain("#101 [end] -> #202 [start]");
    expect(view).toContain("Suppressed dependencies (details only):");
    expect(view).toContain("#202 -> #303 (unschedulable-endpoint)");
  });

  it("hides dependency arrows when toggle is off without popover output", () => {
    const view = renderQueryIntakeView({
      success: true,
      guidance: null,
      flatQuerySupportNote: "Phase 2 note: only flat queries are supported.",
      activeQueryId: "x",
      lastRefreshAt: null,
      reloadSource: "full_reload",
      trustState: "ready",
      strictFail: {
        active: false,
        message: null,
        retryActionLabel: null,
        dismissible: true,
        dismissed: false,
        lastSuccessfulRefreshAt: null,
        lastSuccessfulSource: null
      },
      selectedQueryId: "x",
      savedQueries: [],
      mappingValidation: {
        status: "valid",
        issues: []
      },
      timeline: {
        bars: [],
        unschedulable: [],
        dependencies: [
          {
            predecessorWorkItemId: 1,
            successorWorkItemId: 2,
            dependencyType: "FS",
            label: "#1 [end] -> #2 [start]"
          }
        ],
        suppressedDependencies: [],
        mappingValidation: {
          status: "valid",
          issues: []
        }
      },
      showDependencies: false
    });

    expect(view).toContain("Dependency arrows: hidden");
    expect(view).toContain("- hidden by toggle");
    expect(view).not.toContain("popover");
  });

  it("renders strict-fail warning banner with retry and last successful context", () => {
    const view = renderQueryIntakeView({
      success: true,
      guidance: "Refresh failed (QUERY_EXECUTION_FAILED). Showing last successful timeline from 2026-03-04T20:00:00.000Z. Retry now.",
      flatQuerySupportNote: "Phase 2 note: only flat queries are supported.",
      activeQueryId: "x",
      lastRefreshAt: "2026-03-04T20:00:00.000Z",
      reloadSource: "full_reload",
      trustState: "needs_attention",
      strictFail: {
        active: true,
        message: "Refresh failed (QUERY_EXECUTION_FAILED). Showing last successful timeline from 2026-03-04T20:00:00.000Z. Retry now.",
        retryActionLabel: "Retry now",
        dismissible: true,
        dismissed: false,
        lastSuccessfulRefreshAt: "2026-03-04T20:00:00.000Z",
        lastSuccessfulSource: "full_reload"
      },
      selectedQueryId: "x",
      savedQueries: [],
      mappingValidation: {
        status: "valid",
        issues: []
      },
      timeline: {
        bars: [],
        unschedulable: [],
        dependencies: [],
        suppressedDependencies: [],
        mappingValidation: {
          status: "valid",
          issues: []
        }
      },
      showDependencies: true
    });

    expect(view).toContain("[WARN] Strict-fail fallback active");
    expect(view).toContain("- Last successful refresh: 2026-03-04T20:00:00.000Z");
    expect(view).toContain("- Action: Retry now");
    expect(view).toContain("- Dismiss: available for current state");
  });

  it("does not render strict-fail warning banner after dismiss for current state", () => {
    const view = renderQueryIntakeView({
      success: true,
      guidance: "Refresh failed (QUERY_EXECUTION_FAILED). Showing last successful timeline from 2026-03-04T20:00:00.000Z. Retry now.",
      flatQuerySupportNote: "Phase 2 note: only flat queries are supported.",
      activeQueryId: "x",
      lastRefreshAt: "2026-03-04T20:00:00.000Z",
      reloadSource: "full_reload",
      trustState: "needs_attention",
      strictFail: {
        active: true,
        message: "Refresh failed (QUERY_EXECUTION_FAILED). Showing last successful timeline from 2026-03-04T20:00:00.000Z. Retry now.",
        retryActionLabel: "Retry now",
        dismissible: true,
        dismissed: true,
        lastSuccessfulRefreshAt: "2026-03-04T20:00:00.000Z",
        lastSuccessfulSource: "full_reload"
      },
      selectedQueryId: "x",
      savedQueries: [],
      mappingValidation: {
        status: "valid",
        issues: []
      },
      timeline: {
        bars: [],
        unschedulable: [],
        dependencies: [],
        suppressedDependencies: [],
        mappingValidation: {
          status: "valid",
          issues: []
        }
      },
      showDependencies: true
    });

    expect(view).not.toContain("[WARN] Strict-fail fallback active");
    expect(view).not.toContain("- Action: Retry now");
  });
});
