import { test, expect, type Page } from "@playwright/test";

import { APP_VERSION } from "../../src/shared/project-meta/project-meta.js";

const HARNESS_HTML_URL = "/tests/e2e/runtime-harness.html";
const USER_PREFERENCES_SESSION_KEY = "azure-ganttops.e2e.user-preferences";
const QUERY_IDS = {
  primary: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
  secondary: "8fd61d1a-3aa4-4f90-9bf2-393ca2160be5",
  mapping: "42d1b6a8-f7d2-4d9f-8ad8-b678fa4e2669",
  preferences: "6ef16c10-6e89-4236-98ea-709f63b8fb5f",
  preferencesNext: "5a2ee2b4-03b5-4c85-bf3b-7efe7c6d0f1e"
} as const;

declare global {
  interface Window {
    __phase6Configure: (responses: QueryIntakeResponse[]) => void;
    __phase6DelayNextSubmit: (delayMs: number) => void;
    __phase6Mount: () => void;
    __phase6Read: () => {
      callLog: Array<{ queryInput: string }>;
      density: string | null;
      liveSyncEnabled: string | null;
      adoEntries: Array<{ seq: number; direction: "request" | "response"; url: string }>;
    };
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

const REQUIRED_MAPPING_ISSUES: QueryIntakeResponse["mappingValidation"]["issues"] = [
  {
    code: "MAP_REQUIRED_MISSING",
    field: "id",
    message: "Missing id mapping",
    guidance: "Set ID to System.Id"
  },
  {
    code: "MAP_REQUIRED_MISSING",
    field: "title",
    message: "Missing title mapping",
    guidance: "Set Title to System.Title"
  },
  {
    code: "MAP_REQUIRED_MISSING",
    field: "start",
    message: "Missing start mapping",
    guidance: "Set Start Date to Microsoft.VSTS.Scheduling.StartDate"
  },
  {
    code: "MAP_REQUIRED_MISSING",
    field: "endOrTarget",
    message: "Missing end/target mapping",
    guidance: "Set End/Target Date to Microsoft.VSTS.Scheduling.TargetDate"
  }
];

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

async function mountRuntimeUi(
  page: Page,
  responses: QueryIntakeResponse[],
  preferences: Record<string, unknown> = buildHarnessPreferences()
): Promise<void> {
  await page.goto(HARNESS_HTML_URL);
  await page.waitForFunction(() => typeof window.__phase6Configure === "function");
  await page.evaluate(({ nextResponses, preferences, preferencesKey }) => {
    const currentRaw = window.sessionStorage.getItem(preferencesKey);
    const current =
      currentRaw && typeof currentRaw === "string"
        ? JSON.parse(currentRaw) as Record<string, unknown>
        : {};
    window.sessionStorage.setItem(preferencesKey, JSON.stringify({
      ...current,
      ...preferences
    }));
    window.__phase6Configure(nextResponses);
    window.__phase6Mount();
  }, {
    nextResponses: responses,
    preferences,
    preferencesKey: USER_PREFERENCES_SESSION_KEY
  });
}

async function getRuntimeInfo(page: Page): Promise<{
  callLog: Array<{ queryInput: string }>;
  density: string | null;
  liveSyncEnabled: string | null;
  adoEntries: Array<{ seq: number; direction: "request" | "response"; url: string }>;
}> {
  return page.evaluate(() => window.__phase6Read());
}

function statusBadge(page: Page) {
  return page.locator("details[aria-label='Status']");
}

async function openStatusPanel(page: Page): Promise<void> {
  const badge = statusBadge(page);
  const isOpen = await badge.evaluate((element) => (element as HTMLDetailsElement).open);
  if (!isOpen) {
    await badge.locator("summary").click();
  }
}

async function clickControlsTab(page: Page, tabName: string | RegExp): Promise<void> {
  await openStatusPanel(page);

  await page.getByRole("tab", { name: tabName }).click();
}

function buildHarnessPreferences(): {
  savedQueries: Array<{ id: string; name: string; queryInput: string; organization: string; project: string }>;
  selectedHeaderQueryId: string;
} {
  const savedQueries = Object.entries(QUERY_IDS).map(([name, id]) => ({
    id,
    name: `Harness ${name}`,
    queryInput: buildHarnessQueryUrl(id),
    organization: "contoso",
    project: "delivery"
  }));

  return {
    savedQueries,
    selectedHeaderQueryId: QUERY_IDS.primary
  };
}

function buildHarnessQueryUrl(queryId: string): string {
  return `https://dev.azure.com/contoso/delivery/_queries/query/${queryId}`;
}

test("initial onboarding asks only for a query URL and loads into the timeline", async ({ page }) => {
  const queryUrl = buildHarnessQueryUrl(QUERY_IDS.primary);

  await mountRuntimeUi(page, [
    buildResponse({
      selectedQueryId: QUERY_IDS.primary,
      activeQueryId: QUERY_IDS.primary
    })
  ], {});

  const dialog = page.getByRole("dialog", { name: "Erste Query verbinden" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(1);
  await expect(page.getByLabel("Erststart Query URL")).toBeVisible();
  await expect(dialog.getByText("Organisation")).toHaveCount(0);
  await expect(dialog.getByText("Projekt")).toHaveCount(0);
  await expect(dialog.getByText("Query ID")).toHaveCount(0);

  await page.evaluate(() => window.__phase6DelayNextSubmit(300));
  await page.getByLabel("Erststart Query URL").fill(queryUrl);
  await page.getByRole("button", { name: "Query laden" }).click();

  const submitButton = page.getByRole("button", { name: "Query laden" });
  await expect(submitButton).toBeDisabled();
  await expect(submitButton).toHaveAttribute("aria-busy", "true");
  const submitSpinner = page.getByTestId("initial-query-onboarding-submit-spinner");
  await expect(submitSpinner).toHaveCount(1);
  await expect(submitSpinner).toHaveAttribute("aria-hidden", "true");
  await expect(submitSpinner).toHaveClass(/initial-query-onboarding-submit-spinner/);

  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("timeline-pane")).toBeVisible();

  const runtimeInfo = await getRuntimeInfo(page);
  expect(runtimeInfo.callLog.map((entry) => entry.queryInput)).toEqual([queryUrl]);
});

test("query mapping timeline diagnostics retry refresh source-health journey", async ({ page }) => {
  const responses = [
    buildResponse({
      selectedQueryId: QUERY_IDS.primary,
      activeQueryId: QUERY_IDS.primary,
      savedQueries: [
        { id: QUERY_IDS.primary, name: "Primary query", path: "Shared Queries/Primary" },
        { id: QUERY_IDS.secondary, name: "Secondary query", path: "Shared Queries/Secondary" }
      ]
    }),
    buildResponse({
      selectedQueryId: QUERY_IDS.secondary,
      activeQueryId: QUERY_IDS.secondary,
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
      selectedQueryId: QUERY_IDS.secondary,
      activeQueryId: QUERY_IDS.secondary,
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
      selectedQueryId: QUERY_IDS.primary,
      activeQueryId: QUERY_IDS.primary,
      uiState: "ready",
      trustState: "ready",
      statusCode: "OK"
    }),
    buildResponse({
      selectedQueryId: QUERY_IDS.primary,
      activeQueryId: QUERY_IDS.primary,
      uiState: "ready",
      trustState: "ready",
      statusCode: "OK"
    })
  ];

  await mountRuntimeUi(page, responses);

  await expect(page.getByRole("heading", { name: "AzureGanttOps" })).toBeVisible();
  const changelogButton = page.getByRole("button", { name: `Changelog zu Version ${APP_VERSION} öffnen` });
  await expect(changelogButton).toBeVisible();
  await expect(changelogButton).toHaveText(`Changelog v${APP_VERSION}`);
  await expect(changelogButton).toHaveAttribute("aria-haspopup", "dialog");
  await expect(changelogButton).toHaveAttribute("aria-expanded", "false");
  await changelogButton.click();
  const changelogDialog = page.getByRole("dialog", { name: `Changelog v${APP_VERSION}` });
  await expect(changelogDialog).toBeVisible();
  await expect(changelogButton).toHaveAttribute("aria-expanded", "true");
  await expect(changelogDialog.getByRole("heading", { name: "Changelog", level: 1 })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(changelogDialog).toBeHidden();
  await expect(changelogButton).toHaveAttribute("aria-expanded", "false");
  await expect(statusBadge(page)).toHaveText("Status");
  await expect(statusBadge(page)).not.toContainText("Needs attention");
  await expect(page.getByLabel("timeline-pane")).toBeVisible();

  await clickControlsTab(page, "Mapping [blocked]");
  await expect(page.getByLabel("tab-blocker-guidance")).toContainText("No query selected yet");
  await expect(page.getByRole("tab", { name: "Diagnostics [blocked]" })).toBeVisible();

  await clickControlsTab(page, "Query [ok]");
  await page.getByLabel("Query ID").fill(buildHarnessQueryUrl(QUERY_IDS.primary));
  await page.getByRole("button", { name: "Run query by ID" }).click();
  await expect(statusBadge(page)).toContainText("[OK] Ready");

  await clickControlsTab(page, "Query [ok]");
  await page.getByLabel("Query ID").fill(buildHarnessQueryUrl(QUERY_IDS.secondary));
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await expect(statusBadge(page)).toContainText("[QUERY_FAILED] Partial failure");
  await clickControlsTab(page, "Timeline [ok]");
  await expect(page.getByLabel("timeline-warning-banner")).toContainText("Action: Retry refresh");
  await page.keyboard.press("Escape");

  await page.getByLabel("timeline-warning-banner").getByRole("button", { name: "Retry refresh" }).click();
  await expect(statusBadge(page)).toHaveText("Status");
  await openStatusPanel(page);
  await expect(statusBadge(page)).toContainText("[OK] Ready");

  await clickControlsTab(page, "Query [ok]");
  await page.getByLabel("Query ID").fill(buildHarnessQueryUrl(QUERY_IDS.primary));
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await clickControlsTab(page, "Timeline [ok]");
  await page.keyboard.press("Escape");
  await page.getByLabel("timeline-sidebar-row-801").click();
  await expect(page.getByLabel("timeline-details-panel")).toContainText("- selected work item: #801");

  await clickControlsTab(page, "Diagnostics [ok]");
  await expect(page.getByLabel("diagnostics-tab")).toContainText("source health: HEALTHY");
  await expect(page.getByLabel("ado-communication-log-panel")).toBeVisible();
  await expect(page.getByLabel("ado-communication-log-panel").getByLabel("ado-log-entry").first()).toBeVisible();
  await page.getByLabel("diagnostics-tab").getByRole("button", { name: "Retry refresh" }).click();

  const runtimeInfo = await getRuntimeInfo(page);
  expect(runtimeInfo.callLog.map((entry) => entry.queryInput)).toEqual([
    buildHarnessQueryUrl(QUERY_IDS.primary),
    buildHarnessQueryUrl(QUERY_IDS.secondary),
    buildHarnessQueryUrl(QUERY_IDS.secondary),
    buildHarnessQueryUrl(QUERY_IDS.primary),
    buildHarnessQueryUrl(QUERY_IDS.primary)
  ]);
  expect(runtimeInfo.adoEntries.length).toBeGreaterThanOrEqual(10);
  expect(runtimeInfo.adoEntries[0]?.direction).toBe("request");
  expect(runtimeInfo.adoEntries[1]?.direction).toBe("response");
  expect(runtimeInfo.adoEntries.every((entry) => entry.url.includes("token=%5BREDACTED%5D"))).toBe(true);
});

test("mapping remediation journey: invalid mapping to apply defaults to timeline and diagnostics", async ({ page }) => {
  const responses = [
    buildResponse({
      selectedQueryId: QUERY_IDS.mapping,
      activeQueryId: QUERY_IDS.mapping,
      statusCode: "OK",
      trustState: "needs_attention",
      mappingValidation: {
        status: "invalid",
        issues: REQUIRED_MAPPING_ISSUES
      },
      timeline: null,
      activeMappingProfileId: null
    }),
    buildResponse({
      selectedQueryId: QUERY_IDS.mapping,
      activeQueryId: QUERY_IDS.mapping,
      statusCode: "OK",
      trustState: "ready",
      mappingValidation: {
        status: "valid",
        issues: []
      },
      activeMappingProfileId: "auto-required-defaults"
    })
  ];

  await mountRuntimeUi(page, responses);

  await clickControlsTab(page, "Query [ok]");
  await page.getByLabel("Query ID").fill(buildHarnessQueryUrl(QUERY_IDS.mapping));
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await expect(page.getByLabel("mapping-fix-panel")).toBeVisible();
  await expect(page.getByLabel("mapping-fix-panel")).toContainText("Set up field mapping");
  await page.evaluate(() => window.__phase6DelayNextSubmit(150));
  await page.getByRole("button", { name: "Apply standard Azure mapping" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await page.keyboard.press("Escape");
  await expect(statusBadge(page)).toHaveText("Status");

  await expect(statusBadge(page)).toHaveText("Status");
  await expect(page.getByLabel("timeline-pane")).toBeVisible();

  await page.getByLabel("timeline-sidebar-row-801").click();
  await expect(page.getByLabel("timeline-details-panel")).toContainText("- selected work item: #801");

  await clickControlsTab(page, "Diagnostics [ok]");
  await expect(page.getByLabel("diagnostics-tab")).toContainText(`active query source: ${QUERY_IDS.mapping}`);

  const runtimeInfo = await getRuntimeInfo(page);
  expect(runtimeInfo.callLog.map((entry) => entry.queryInput)).toEqual([
    buildHarnessQueryUrl(QUERY_IDS.mapping),
    QUERY_IDS.mapping
  ]);
});

test("timeline live-sync preference persists across query switch and remount", async ({ page }) => {
  const responses = [
    buildResponse({
      selectedQueryId: QUERY_IDS.preferences,
      activeQueryId: QUERY_IDS.preferences,
      savedQueries: [
        { id: QUERY_IDS.preferences, name: "Preferences query", path: "Shared Queries/Preferences" },
        { id: QUERY_IDS.preferencesNext, name: "Preferences query 2", path: "Shared Queries/Preferences2" }
      ]
    }),
    buildResponse({
      selectedQueryId: QUERY_IDS.preferencesNext,
      activeQueryId: QUERY_IDS.preferencesNext
    })
  ];

  await mountRuntimeUi(page, responses);

  await clickControlsTab(page, "Query [ok]");

  await page.getByLabel("Query ID").fill(buildHarnessQueryUrl(QUERY_IDS.preferences));
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await clickControlsTab(page, "Timeline [ok]");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Live sync")).toBeChecked();

  await page.getByLabel("Live sync").click();
  await expect(page.getByLabel("Live sync")).not.toBeChecked();
  let runtimeInfo = await getRuntimeInfo(page);
  expect(runtimeInfo.liveSyncEnabled).toBe("false");

  await clickControlsTab(page, "Query [ok]");
  await page.getByLabel("Query ID").fill(buildHarnessQueryUrl(QUERY_IDS.preferencesNext));
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await clickControlsTab(page, "Timeline [ok]");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Live sync")).not.toBeChecked();

  await mountRuntimeUi(page, [
    buildResponse({
      selectedQueryId: QUERY_IDS.preferencesNext,
      activeQueryId: QUERY_IDS.preferencesNext
    })
  ]);
  await clickControlsTab(page, "Query [ok]");
  await page.getByLabel("Query ID").fill(buildHarnessQueryUrl(QUERY_IDS.preferencesNext));
  await page.getByRole("button", { name: "Run query by ID" }).click();

  await clickControlsTab(page, "Timeline [ok]");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Live sync")).not.toBeChecked();
});
