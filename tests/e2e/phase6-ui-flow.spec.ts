import { test, expect, type Page } from "@playwright/test";

const HARNESS_HTML_URL = "/tests/e2e/runtime-harness.html";

declare global {
  interface Window {
    __phase6Configure: (responses: QueryIntakeResponse[]) => void;
    __phase6Mount: () => void;
    __phase6Read: () => { callLog: Array<{ queryInput: string }>; density: string | null };
  }
}

type QueryIntakeResponse = {
  success: boolean;
  guidance: string | null;
  statusCode: string;
  errorCode: string | null;
  preflightStatus: "READY" | "SESSION_EXPIRED" | "MISSING_EXTENSION" | "CONTEXT_MISMATCH" | "CLI_NOT_FOUND" | "UNKNOWN_ERROR";
  selectedQueryId: string | null;
  activeQueryId: string | null;
  lastRefreshAt: string | null;
  reloadSource: "full_reload" | "preflight_blocked" | "stale_discarded" | null;
  uiState: "loading" | "empty" | "auth_failure" | "query_failure" | "partial_failure" | "ready" | "ready_with_lkg_warning";
  trustState: "ready" | "needs_attention" | "partial_failure";
  strictFail: {
    active: boolean;
    message: string | null;
    retryActionLabel: string | null;
    dismissible: boolean;
    dismissed: boolean;
    lastSuccessfulRefreshAt: string | null;
    lastSuccessfulSource: "full_reload" | "preflight_blocked" | "stale_discarded" | null;
  };
  capabilities: {
    canRefresh: boolean;
    canSwitchQuery: boolean;
    canChangeDensity: boolean;
    canOpenDetails: boolean;
    readOnlyTimeline: boolean;
  };
  density: "comfortable" | "compact";
  savedQueries: Array<{ id: string; name: string; path: string }>;
  workItemIds: number[];
  relations: Array<{
    type:
      | "System.LinkTypes.Dependency-Forward"
      | "System.LinkTypes.Dependency-Reverse"
      | "System.LinkTypes.Hierarchy-Forward"
      | "System.LinkTypes.Hierarchy-Reverse";
    sourceId: number;
    targetId: number;
  }>;
  timeline: {
    bars: Array<{
      workItemId: number;
      title: string;
      state: { code: string; badge: string; color: string };
      schedule: {
        startDate: string | null;
        endDate: string | null;
        missingBoundary: "start" | "end" | null;
      };
      details: {
        mappedId: string;
      };
    }>;
    unschedulable: Array<{
      workItemId: number;
      title: string;
      state: { code: string; badge: string; color: string };
      details: { mappedId: string };
      reason: "missing-both-dates";
    }>;
    dependencies: Array<{
      predecessorWorkItemId: number;
      successorWorkItemId: number;
      dependencyType: "FS";
      label: string;
    }>;
    suppressedDependencies: Array<{
      predecessorWorkItemId: number;
      successorWorkItemId: number;
      dependencyType: "FS";
      reason: "unschedulable-endpoint";
    }>;
    mappingValidation: {
      status: "valid" | "invalid";
      issues: Array<{
        code: "MAP_REQUIRED_MISSING" | "MAP_REQUIRED_BLANK" | "MAP_REQUIRED_DUPLICATE";
        field: "id" | "title" | "start" | "endOrTarget";
        message: string;
        guidance: string;
      }>;
    };
  } | null;
  mappingValidation: {
    status: "valid" | "invalid";
    issues: Array<{
      code: "MAP_REQUIRED_MISSING" | "MAP_REQUIRED_BLANK" | "MAP_REQUIRED_DUPLICATE";
      field: "id" | "title" | "start" | "endOrTarget";
      message: string;
      guidance: string;
    }>;
  };
  activeMappingProfileId: string | null;
  view: string;
};

type ResponsePatch = Partial<QueryIntakeResponse> & {
  savedQueries?: Array<{ id: string; name: string; path: string }>;
};

function buildResponse(patch: ResponsePatch = {}): QueryIntakeResponse {
  const selectedQueryId = patch.selectedQueryId ?? patch.activeQueryId ?? "q-default";
  const activeQueryId = patch.activeQueryId ?? selectedQueryId;

  return {
    success: patch.success ?? true,
    guidance: patch.guidance ?? null,
    statusCode: patch.statusCode ?? "OK",
    errorCode: patch.errorCode ?? null,
    preflightStatus: patch.preflightStatus ?? "READY",
    selectedQueryId,
    activeQueryId,
    lastRefreshAt: patch.lastRefreshAt ?? "2026-03-06T10:00:00.000Z",
    reloadSource: patch.reloadSource ?? "full_reload",
    uiState: patch.uiState ?? "ready",
    trustState: patch.trustState ?? "ready",
    strictFail:
      patch.strictFail ?? {
        active: false,
        message: null,
        retryActionLabel: null,
        dismissible: true,
        dismissed: false,
        lastSuccessfulRefreshAt: patch.lastRefreshAt ?? "2026-03-06T10:00:00.000Z",
        lastSuccessfulSource: patch.reloadSource ?? "full_reload"
      },
    capabilities:
      patch.capabilities ?? {
        canRefresh: true,
        canSwitchQuery: true,
        canChangeDensity: true,
        canOpenDetails: true,
        readOnlyTimeline: true
      },
    density: patch.density ?? "comfortable",
    savedQueries:
      patch.savedQueries ??
      [
        {
          id: selectedQueryId,
          name: "Primary query",
          path: "Shared Queries/Primary"
        }
      ],
    workItemIds: patch.workItemIds ?? [801, 802],
    relations: patch.relations ?? [],
    timeline:
      patch.timeline ?? {
        bars: [
          {
            workItemId: 801,
            title: "Alpha timeline item",
            state: { code: "Active", badge: "A", color: "#1d4ed8" },
            schedule: {
              startDate: "2026-03-01T00:00:00.000Z",
              endDate: "2026-03-02T00:00:00.000Z",
              missingBoundary: null
            },
            details: { mappedId: "WI-801" }
          },
          {
            workItemId: 802,
            title: "Beta timeline item",
            state: { code: "New", badge: "N", color: "#7c3aed" },
            schedule: {
              startDate: "2026-03-03T00:00:00.000Z",
              endDate: "2026-03-04T00:00:00.000Z",
              missingBoundary: null
            },
            details: { mappedId: "WI-802" }
          }
        ],
        unschedulable: [],
        dependencies: [
          {
            predecessorWorkItemId: 801,
            successorWorkItemId: 802,
            dependencyType: "FS",
            label: "#801 [end] -> #802 [start]"
          }
        ],
        suppressedDependencies: [],
        mappingValidation: {
          status: "valid",
          issues: []
        }
      },
    mappingValidation:
      patch.mappingValidation ?? {
        status: "valid",
        issues: []
      },
    activeMappingProfileId: patch.activeMappingProfileId ?? "profile-default",
    view: patch.view ?? "ui"
  };
}

async function mountRuntimeUi(page: Page, responses: QueryIntakeResponse[]): Promise<void> {
  await page.goto(HARNESS_HTML_URL);
  await page.waitForFunction(() => typeof window.__phase6Configure === "function");
  await page.evaluate((nextResponses) => {
    window.__phase6Configure(nextResponses);
    window.__phase6Mount();
  }, responses);
}

async function getRuntimeInfo(page: Page): Promise<{ callLog: Array<{ queryInput: string }>; density: string | null }> {
  return page.evaluate(() => window.__phase6Read());
}

test("query mapping timeline diagnostics retry refresh source-health journey", async ({ page }) => {
  const responses = [
    buildResponse({
      selectedQueryId: "q-1",
      activeQueryId: "q-1",
      savedQueries: [
        { id: "q-1", name: "Primary query", path: "Shared Queries/Primary" },
        { id: "q-2", name: "Secondary query", path: "Shared Queries/Secondary" }
      ]
    }),
    buildResponse({
      selectedQueryId: "q-2",
      activeQueryId: "q-2",
      uiState: "ready_with_lkg_warning",
      trustState: "partial_failure",
      guidance: "Refresh failed; last-known-good timeline retained.",
      strictFail: {
        active: true,
        message: "Refresh failed; showing last-known-good timeline.",
        retryActionLabel: "Retry refresh",
        dismissible: true,
        dismissed: false,
        lastSuccessfulRefreshAt: "2026-03-06T09:59:00.000Z",
        lastSuccessfulSource: "full_reload"
      },
      errorCode: "UNKNOWN_ERROR",
      statusCode: "QUERY_FAILED"
    }),
    buildResponse({
      selectedQueryId: "q-2",
      activeQueryId: "q-2",
      uiState: "ready",
      trustState: "ready",
      statusCode: "OK",
      errorCode: null,
      strictFail: {
        active: false,
        message: null,
        retryActionLabel: null,
        dismissible: true,
        dismissed: false,
        lastSuccessfulRefreshAt: "2026-03-06T10:05:00.000Z",
        lastSuccessfulSource: "full_reload"
      }
    }),
    buildResponse({
      selectedQueryId: "q-1",
      activeQueryId: "q-1",
      uiState: "ready",
      trustState: "ready",
      statusCode: "OK"
    }),
    buildResponse({
      selectedQueryId: "q-1",
      activeQueryId: "q-1",
      uiState: "ready",
      trustState: "ready",
      statusCode: "OK"
    })
  ];

  await mountRuntimeUi(page, responses);

  await expect(page.getByRole("heading", { name: "Azure DevOps Query-Driven Gantt" })).toBeVisible();
  await expect(page.getByLabel("global-trust-badge")).toContainText("Needs attention");

  await page.getByRole("tab", { name: "Mapping [blocked]" }).click();
  await expect(page.getByLabel("tab-blocker-guidance")).toContainText("No query selected yet");

  await page.getByRole("tab", { name: "Query [ok]" }).click();
  await page.getByLabel("Query ID").fill("q-1");
  await page.getByRole("button", { name: "Run query by ID" }).click();
  await expect(page.getByLabel("global-trust-badge")).toContainText("[OK] Ready");

  await page.getByRole("tab", { name: "Query [ok]" }).click();
  await page.getByLabel("Query ID").fill("q-2");
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await expect(page.getByLabel("global-trust-badge")).toContainText("[QUERY_FAILED] Partial failure");
  await page.getByRole("tab", { name: "Timeline [ok]" }).click();
  await expect(page.getByLabel("timeline-warning-banner")).toContainText("Action: Retry refresh");

  await page.getByRole("button", { name: "Retry refresh" }).first().click();
  await expect(page.getByLabel("global-trust-badge")).toContainText("[OK] Ready");

  await page.getByRole("tab", { name: "Query [ok]" }).click();
  await page.getByLabel("Query ID").fill("q-1");
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await page.getByRole("tab", { name: "Timeline [ok]" }).click();
  await page.getByRole("button", { name: "Select first item" }).click();
  await expect(page.getByLabel("selected-timeline-item")).toContainText("Alpha timeline item");
  await expect(page.getByLabel("timeline-details-panel")).toContainText("- selected work item: #801");

  await page.getByRole("tab", { name: "Diagnostics [ok]" }).click();
  await expect(page.getByLabel("diagnostics-tab")).toContainText("source health: HEALTHY");
  await page.getByRole("button", { name: "Retry refresh" }).click();

  const runtimeInfo = await getRuntimeInfo(page);
  expect(runtimeInfo.callLog.map((entry) => entry.queryInput)).toEqual(["q-1", "q-2", "q-2", "q-1", "q-1"]);
});

test("density timeline preference persists across query switch and remount", async ({ page }) => {
  const responses = [
    buildResponse({
      selectedQueryId: "q-density",
      activeQueryId: "q-density",
      savedQueries: [
        { id: "q-density", name: "Density query", path: "Shared Queries/Density" },
        { id: "q-density-2", name: "Density query 2", path: "Shared Queries/Density2" }
      ]
    }),
    buildResponse({
      selectedQueryId: "q-density-2",
      activeQueryId: "q-density-2"
    })
  ];

  await mountRuntimeUi(page, responses);

  await page.getByLabel("Query ID").fill("q-density");
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await page.getByRole("tab", { name: "Timeline [ok]" }).click();
  await expect(page.getByLabel("timeline-pane")).toContainText("Density mode: comfortable");

  await page.getByRole("button", { name: "Compact" }).click();
  let runtimeInfo = await getRuntimeInfo(page);
  expect(runtimeInfo.density).toBe("compact");

  await page.getByRole("tab", { name: "Query [ok]" }).click();
  await page.getByLabel("Query ID").fill("q-density-2");
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await page.getByRole("tab", { name: "Timeline [ok]" }).click();
  await expect(page.getByLabel("timeline-pane")).toContainText("Density mode: compact");

  await mountRuntimeUi(page, [buildResponse({ selectedQueryId: "q-density-2", activeQueryId: "q-density-2" })]);
  await page.getByLabel("Query ID").fill("q-density-2");
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await page.getByRole("tab", { name: "Timeline [ok]" }).click();
  await expect(page.getByLabel("timeline-pane")).toContainText("Density mode: compact");
});
