import { expect, test, type Page } from "@playwright/test";

const HARNESS_HTML_URL = "/tests/e2e/runtime-harness.html";

declare global {
  interface Window {
    __phase6Configure: (responses: QueryIntakeResponse[]) => void;
    __phase6Mount: () => void;
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

function buildResponse(): QueryIntakeResponse {
  return {
    success: true,
    guidance: null,
    statusCode: "OK",
    errorCode: null,
    preflightStatus: "READY",
    selectedQueryId: "q-axis",
    activeQueryId: "q-axis",
    lastRefreshAt: "2026-03-06T10:00:00.000Z",
    reloadSource: "full_reload",
    uiState: "ready",
    trustState: "ready",
    strictFail: {
      active: false,
      message: null,
      retryActionLabel: null,
      dismissible: true,
      dismissed: false,
      lastSuccessfulRefreshAt: "2026-03-06T10:00:00.000Z",
      lastSuccessfulSource: "full_reload"
    },
    capabilities: {
      canRefresh: true,
      canSwitchQuery: true,
      canChangeDensity: true,
      canOpenDetails: true,
      readOnlyTimeline: true
    },
    density: "comfortable",
    savedQueries: [{ id: "q-axis", name: "Axis Query", path: "Shared Queries/Axis" }],
    workItemIds: [9001, 9002, 9003, 9004],
    relations: [],
    timeline: {
      bars: [
        {
          workItemId: 9001,
          title: "Planning",
          state: { code: "Active", badge: "A", color: "#1d4ed8" },
          schedule: {
            startDate: "2024-01-03T00:00:00.000Z",
            endDate: "2024-01-24T00:00:00.000Z",
            missingBoundary: null
          },
          details: { mappedId: "WI-9001" }
        },
        {
          workItemId: 9002,
          title: "Implementation",
          state: { code: "Active", badge: "A", color: "#7c3aed" },
          schedule: {
            startDate: "2024-01-22T00:00:00.000Z",
            endDate: "2024-02-29T00:00:00.000Z",
            missingBoundary: null
          },
          details: { mappedId: "WI-9002" }
        },
        {
          workItemId: 9003,
          title: "Hardening",
          state: { code: "New", badge: "N", color: "#0f766e" },
          schedule: {
            startDate: "2024-03-01T00:00:00.000Z",
            endDate: "2024-03-28T00:00:00.000Z",
            missingBoundary: null
          },
          details: { mappedId: "WI-9003" }
        },
        {
          workItemId: 9004,
          title: "Release",
          state: { code: "New", badge: "N", color: "#b45309" },
          schedule: {
            startDate: "2024-03-20T00:00:00.000Z",
            endDate: "2024-04-15T00:00:00.000Z",
            missingBoundary: null
          },
          details: { mappedId: "WI-9004" }
        }
      ],
      unschedulable: [],
      dependencies: [],
      suppressedDependencies: [],
      mappingValidation: {
        status: "valid",
        issues: []
      }
    },
    mappingValidation: {
      status: "valid",
      issues: []
    },
    activeMappingProfileId: "profile-axis",
    view: "ui"
  };
}

async function mountRuntimeUi(page: Page): Promise<void> {
  await page.goto(HARNESS_HTML_URL);
  await page.waitForFunction(() => typeof window.__phase6Configure === "function");
  await page.evaluate((response) => {
    window.localStorage.clear();
    window.__phase6Configure([response]);
    window.__phase6Mount();
  }, buildResponse());
}

test("timeline axis stays visually coupled to week/month boundary lines", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mountRuntimeUi(page);

  await expect(page.getByLabel("timeline-pane")).toBeVisible();
  await page.getByRole("tab", { name: "Query [ok]" }).click();
  await page.getByLabel("Query ID").fill("q-axis");
  await page.getByRole("button", { name: "Run query by ID" }).click();
  await page.getByRole("tab", { name: /Timeline/ }).click();

  const lane = page.locator(".timeline-chart-main-lane");
  await expect(lane).toBeVisible();

  await page.getByLabel("Zoom in to week view").click();
  await expect(lane).toHaveScreenshot("timeline-axis-alignment-week.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01
  });

  await page.getByLabel("Zoom out to month view").click();
  await expect(lane).toHaveScreenshot("timeline-axis-alignment-month.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01
  });
});
