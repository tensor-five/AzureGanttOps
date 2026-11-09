/**
 * Frozen E2E tests for the approved contract
 * docs/contracts/details-panel-field-configuration.v1.html (DPF-01 .. DPF-22).
 * Each test title starts with the requirement IDs it verifies; see
 * docs/contracts/details-panel-field-configuration.v1.traceability.md.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

const HARNESS_HTML_URL = "/tests/e2e/runtime-harness.html";
const APP_STYLESHEET_URL = "/dist/src/app/bootstrap/local-ui-entry.browser.css";
const USER_PREFERENCES_SESSION_KEY = "azure-ganttops.e2e.user-preferences";
const QUERY_A = "3c0f7a52-6f0e-4b8c-9a51-1d7e0b5f2a10";
const QUERY_B = "7d2e9b14-2c4a-4f6d-8e37-5a9c1b0d3e21";

const REF = {
  title: "System.Title",
  state: "System.State",
  description: "System.Description",
  assignedTo: "System.AssignedTo",
  storyPoints: "Microsoft.VSTS.Scheduling.StoryPoints",
  priority: "Microsoft.VSTS.Common.Priority",
  remainingWork: "Microsoft.VSTS.Scheduling.RemainingWork",
  valueArea: "Microsoft.VSTS.Common.ValueArea",
  areaPath: "System.AreaPath",
  tags: "System.Tags",
  createdDate: "System.CreatedDate",
  blocked: "Custom.Blocked",
  notes: "Custom.Notes",
  acceptanceCriteria: "Microsoft.VSTS.Common.AcceptanceCriteria",
  startDate: "Microsoft.VSTS.Scheduling.StartDate",
  targetDate: "Microsoft.VSTS.Scheduling.TargetDate",
  id: "System.Id",
  workItemType: "System.WorkItemType",
  changedBy: "System.ChangedBy",
  externalRef: "Custom.ExternalRef",
  correlationId: "Custom.CorrelationId"
} as const;

const PRIMARY_RGB = "rgb(132, 44, 195)";
const MUTED_TEXT_LIGHT_RGB = "rgb(168, 162, 158)";

const DEFAULT_FIELD_ORDER = ["Title", "State", "Assigned To", "Start", "End", "Story Points", "Dependencies", "Description"];
const LONG_AREA_PATH = "Delivery\\Platform\\Frontend\\Timeline\\Details Panel\\Field Configuration\\Very Long Area Segment";

type FieldDefinition = {
  referenceName: string;
  name: string;
  type: string;
  readOnly: boolean;
  isIdentity: boolean;
  allowedValues: string[];
  workItemTypes: string[];
};

declare global {
  interface Window {
    __phase6Configure: (responses: unknown[]) => void;
    __phase6Mount: () => void;
    __phase6ConfigureFieldDefinitions: (config: { fields: unknown[] } | { error: string }) => void;
    __phase6FailNextDetailsUpdate: (message: string) => void;
    __phase6Read: () => {
      callLog: Array<{ queryInput: string }>;
      fieldDefinitionRequests: unknown[];
      detailsUpdates: unknown[];
    };
  }
}

function definition(
  referenceName: string,
  name: string,
  type: string,
  options: Partial<Pick<FieldDefinition, "readOnly" | "isIdentity" | "allowedValues" | "workItemTypes">> = {}
): FieldDefinition {
  return {
    referenceName,
    name,
    type,
    readOnly: options.readOnly ?? false,
    isIdentity: options.isIdentity ?? false,
    allowedValues: options.allowedValues ?? [],
    workItemTypes: options.workItemTypes ?? ["User Story", "Bug"]
  };
}

function buildFieldDefinitions(): FieldDefinition[] {
  return [
    definition(REF.title, "Title", "string"),
    definition(REF.state, "State", "string", { allowedValues: ["New", "Active", "Resolved", "Closed"] }),
    definition(REF.description, "Description", "html"),
    definition(REF.assignedTo, "Assigned To", "identity", { isIdentity: true }),
    definition(REF.storyPoints, "Story Points", "double", { workItemTypes: ["User Story"] }),
    definition(REF.priority, "Priority", "integer"),
    definition(REF.remainingWork, "Remaining Work", "double", { workItemTypes: ["Bug"] }),
    definition(REF.valueArea, "Value Area", "string", { allowedValues: ["Business", "Architectural"] }),
    definition(REF.areaPath, "Area Path", "treePath"),
    definition(REF.tags, "Tags", "plainText"),
    definition(REF.createdDate, "Created Date", "dateTime", { readOnly: true }),
    definition(REF.blocked, "Blocked", "boolean"),
    definition(REF.notes, "Notes", "string"),
    definition(REF.acceptanceCriteria, "Acceptance Criteria", "html"),
    definition(REF.startDate, "Start Date", "dateTime"),
    definition(REF.targetDate, "Target Date", "dateTime"),
    definition(REF.id, "ID", "integer", { readOnly: true }),
    definition(REF.workItemType, "Work Item Type", "string", { readOnly: true }),
    definition(REF.changedBy, "Changed By", "identity", { isIdentity: true }),
    definition(REF.externalRef, "External Ref", "string", { readOnly: true }),
    definition(REF.correlationId, "Correlation Id", "guid")
  ];
}

function buildTimeline(options: { storyPoints?: number | null } = {}) {
  const storyPoints = options.storyPoints === undefined ? 5 : options.storyPoints;
  return {
    bars: [
      {
        workItemId: 801,
        title: "Alpha timeline item",
        state: { code: "Active", badge: "A", color: "#1d4ed8" },
        schedule: {
          startDate: "2026-03-02T08:00:00.000Z",
          endDate: "2026-03-06T16:00:00.000Z",
          missingBoundary: null,
          iterationFallback: "end"
        },
        details: {
          mappedId: "WI-801",
          descriptionHtml: "<p>Alpha description</p>",
          workItemType: "User Story",
          assignedTo: "Ada Lovelace",
          parentWorkItemId: null,
          fieldValues: {
            [REF.storyPoints]: storyPoints,
            [REF.priority]: 2,
            [REF.valueArea]: "Business",
            [REF.areaPath]: LONG_AREA_PATH,
            [REF.tags]: "auth; reliability",
            [REF.createdDate]: "2026-02-20T09:30:00.000Z",
            [REF.blocked]: "False",
            [REF.notes]: "Alpha notes",
            [REF.assignedTo]: "Ada Lovelace",
            [REF.changedBy]: "Grace Hopper",
            [REF.externalRef]: "EXT-42",
            [REF.correlationId]: "6f1c2d3e-4b5a-4978-8a1b-2c3d4e5f6a7b",
            [REF.acceptanceCriteria]: "<p>Alpha criteria</p>",
            "System.WorkItemType": "User Story"
          }
        }
      },
      {
        workItemId: 802,
        title: "Beta timeline item",
        state: { code: "New", badge: "N", color: "#7c3aed" },
        schedule: {
          startDate: "2026-03-09T08:00:00.000Z",
          endDate: "2026-03-11T16:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "WI-802",
          descriptionHtml: "<p>Beta description</p>",
          workItemType: "Bug",
          assignedTo: "Grace Hopper",
          parentWorkItemId: null,
          fieldValues: {
            [REF.priority]: null,
            [REF.remainingWork]: 4,
            [REF.assignedTo]: "Grace Hopper",
            "System.WorkItemType": "Bug"
          }
        }
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
    mappingValidation: { status: "valid", issues: [] },
    scheduleFieldRefs: {
      start: "Microsoft.VSTS.Scheduling.StartDate",
      endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
    },
    treeLayout: null,
    queryType: "flat"
  };
}

function buildResponse(queryId: string, timeline: unknown = buildTimeline()) {
  return {
    success: true,
    guidance: null,
    statusCode: "OK",
    errorCode: null,
    preflightStatus: "READY",
    selectedQueryId: queryId,
    activeQueryId: queryId,
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
      readOnlyTimeline: false
    },
    density: "comfortable",
    savedQueries: [
      { id: QUERY_A, name: "Query A", path: "Shared Queries/A" },
      { id: QUERY_B, name: "Query B", path: "Shared Queries/B" }
    ],
    workItemIds: [801, 802],
    relations: [],
    timeline,
    mappingValidation: { status: "valid", issues: [] },
    activeMappingProfileId: "profile-default",
    view: "ui"
  };
}

function queryUrl(queryId: string): string {
  return `https://dev.azure.com/contoso/delivery/_queries/query/${queryId}`;
}

function harnessPreferences(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    savedQueries: [QUERY_A, QUERY_B].map((id, index) => ({
      id,
      name: `Harness ${index === 0 ? "A" : "B"}`,
      queryInput: queryUrl(id),
      organization: "contoso",
      project: "delivery"
    })),
    selectedHeaderQueryId: QUERY_A,
    ...extra
  };
}

async function mount(
  page: Page,
  options: {
    responses?: unknown[];
    fieldDefinitions?: { fields: unknown[] } | { error: string };
    preferences?: Record<string, unknown>;
    resetPreferences?: boolean;
    keepUrl?: boolean;
  } = {}
): Promise<void> {
  if (!options.keepUrl) {
    await page.goto(HARNESS_HTML_URL);
  }
  await page.addStyleTag({ url: APP_STYLESHEET_URL });
  await page.waitForFunction(() => typeof window.__phase6Configure === "function");
  await page.evaluate(
    ({ responses, fieldDefinitions, preferences, preferencesKey, resetPreferences }) => {
      const currentRaw = resetPreferences ? null : window.sessionStorage.getItem(preferencesKey);
      const current = currentRaw ? (JSON.parse(currentRaw) as Record<string, unknown>) : {};
      window.sessionStorage.setItem(preferencesKey, JSON.stringify({ ...current, ...preferences }));
      window.__phase6ConfigureFieldDefinitions(fieldDefinitions);
      window.__phase6Configure(responses);
      window.__phase6Mount();
    },
    {
      responses: options.responses ?? [buildResponse(QUERY_A)],
      fieldDefinitions: options.fieldDefinitions ?? { fields: buildFieldDefinitions() },
      preferences: options.preferences ?? harnessPreferences(),
      preferencesKey: USER_PREFERENCES_SESSION_KEY,
      resetPreferences: options.resetPreferences ?? true
    }
  );
}

async function openControlsTab(page: Page, tabName: string | RegExp): Promise<void> {
  const badge = page.locator("details[aria-label='Status']");
  const isOpen = await badge.evaluate((element) => (element as HTMLDetailsElement).open);
  if (!isOpen) {
    await badge.locator("summary").click();
  }
  await page.getByRole("tab", { name: tabName }).click();
}

async function runQuery(page: Page, queryId: string): Promise<void> {
  await openControlsTab(page, /^Query/);
  await page.getByLabel("Query ID").fill(queryUrl(queryId));
  await page.getByRole("button", { name: "Run query by ID" }).click();
  await openControlsTab(page, /^Timeline/);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("timeline-sidebar-row-801")).toBeVisible();
}

async function mountAndLoad(page: Page, options: Parameters<typeof mount>[1] = {}): Promise<void> {
  await mount(page, options);
  await runQuery(page, QUERY_A);
}

function detailsPanel(page: Page): Locator {
  return page.getByLabel("timeline-details-panel");
}

function configToggle(page: Page): Locator {
  return detailsPanel(page).getByRole("button", { name: "Configure details fields" });
}

function configDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Details fields" });
}

function shownList(page: Page): Locator {
  return configDialog(page).getByRole("list", { name: "Shown fields" });
}

function availableList(page: Page): Locator {
  return configDialog(page).getByRole("list", { name: "Available fields" });
}

function shownItem(page: Page, name: string): Locator {
  return shownList(page)
    .getByRole("listitem")
    .filter({ has: page.locator("strong", { hasText: new RegExp(`^${escapeRegExp(name)}$`) }) });
}

function availableItem(page: Page, name: string): Locator {
  return availableList(page)
    .getByRole("listitem")
    .filter({ has: page.locator("strong", { hasText: new RegExp(`^${escapeRegExp(name)}$`) }) });
}

function fieldBlocks(page: Page): Locator {
  return detailsPanel(page).locator(".timeline-details-field");
}

function fieldBlock(page: Page, label: string): Locator {
  return fieldBlocks(page).filter({
    has: page.locator(".timeline-details-label", { hasText: new RegExp(`^${escapeRegExp(label)}$`) })
  });
}

async function panelFieldLabels(page: Page): Promise<string[]> {
  return (await fieldBlocks(page).locator(".timeline-details-label").allTextContents()).map((text) =>
    text.replace(/\s*•\s*$/, "").trim()
  );
}

async function shownFieldNames(page: Page): Promise<string[]> {
  return (await shownList(page).getByRole("listitem").locator("strong").allTextContents()).map((text) => text.trim());
}

async function availableFieldNames(page: Page): Promise<string[]> {
  return (await availableList(page).getByRole("listitem").locator("strong").allTextContents()).map((text) => text.trim());
}

async function selectItem(page: Page, workItemId: number): Promise<void> {
  const alreadySelected = await detailsPanel(page).getByText(`#${workItemId}`, { exact: true }).isVisible();
  if (!alreadySelected) {
    await page.getByLabel(`timeline-sidebar-row-${workItemId}`).click();
  }
  await expect(detailsPanel(page).getByText(`#${workItemId}`, { exact: true })).toBeVisible();
}

async function openConfig(page: Page): Promise<void> {
  await configToggle(page).click();
  await expect(configDialog(page)).toBeVisible();
}

async function closeConfig(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(configDialog(page)).toBeHidden();
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Element has no bounding box");
  }
  return box;
}

async function setDetailsPanelWidth(page: Page, targetWidthPx: number, options: { exact?: boolean } = {}): Promise<void> {
  const splitter = page.getByRole("separator", { name: /details panel/i });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const panelWidth = (await boxOf(detailsPanel(page))).width;
    const delta = panelWidth - targetWidthPx;
    if (Math.abs(delta) <= 2) {
      return;
    }
    const splitterBox = await boxOf(splitter);
    const startX = splitterBox.x + splitterBox.width / 2;
    const startY = splitterBox.y + Math.min(splitterBox.height / 2, 200);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + delta / 2, startY, { steps: 4 });
    await page.mouse.move(startX + delta, startY, { steps: 4 });
    await page.mouse.up();
  }
  if (options.exact ?? true) {
    expect(Math.abs((await boxOf(detailsPanel(page))).width - targetWidthPx)).toBeLessThanOrEqual(2);
  }
}

async function detailsContentWidth(page: Page): Promise<number> {
  return detailsPanel(page).evaluate((element) => {
    const style = getComputedStyle(element);
    return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  });
}

async function setDetailsContentWidth(page: Page, targetContentWidthPx: number): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const content = await detailsContentWidth(page);
    if (Math.abs(content - targetContentWidthPx) <= 1) {
      return;
    }
    const panelWidth = (await boxOf(detailsPanel(page))).width;
    await setDetailsPanelWidth(page, panelWidth + (targetContentWidthPx - content), { exact: false });
  }
  expect(Math.abs((await detailsContentWidth(page)) - targetContentWidthPx)).toBeLessThanOrEqual(1);
}

function shownCountHeader(page: Page): Locator {
  return configDialog(page).getByText("Shown", { exact: true }).locator("xpath=..");
}

async function expectSameRow(left: Locator, right: Locator, panel: Locator): Promise<void> {
  const [leftBox, rightBox, panelBox] = await Promise.all([boxOf(left), boxOf(right), boxOf(panel)]);
  expect(Math.abs(leftBox.y - rightBox.y)).toBeLessThanOrEqual(1);
  expect(leftBox.x).toBeLessThan(rightBox.x);
  expect(leftBox.width).toBeLessThan(panelBox.width * 0.6);
  expect(rightBox.width).toBeLessThan(panelBox.width * 0.6);
}

async function expectFullWidth(block: Locator, panel: Locator): Promise<void> {
  const [blockBox, panelBox] = await Promise.all([boxOf(block), boxOf(panel)]);
  expect(blockBox.width).toBeGreaterThan(panelBox.width * 0.9);
}

async function readHarness(page: Page) {
  return page.evaluate(() => window.__phase6Read());
}

async function readStoredPreferences(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(window.sessionStorage.getItem(key) ?? "{}") as Record<string, unknown>, USER_PREFERENCES_SESSION_KEY);
}

function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lastDetailsUpdate(updates: unknown[]): { targetWorkItemId?: number; fields?: Record<string, unknown> } {
  return (updates[updates.length - 1] ?? {}) as { targetWorkItemId?: number; fields?: Record<string, unknown> };
}

async function addFieldViaConfig(page: Page, name: string): Promise<void> {
  await availableItem(page, name).getByRole("button", { name: `Show ${name}` }).click();
}

async function configureShownFields(page: Page, names: string[]): Promise<void> {
  await openConfig(page);
  for (const name of await shownFieldNames(page)) {
    await shownItem(page, name).getByRole("button", { name: `Remove ${name}` }).click();
  }
  for (const name of names) {
    await addFieldViaConfig(page, name);
  }
  await closeConfig(page);
}

test.describe("details panel field configuration", () => {
  test("DPF-01 gear button sits next to the ID pill, works without selection and hides with hidden content", async ({ page }) => {
    await mountAndLoad(page);

    await expect(configToggle(page)).toBeVisible();
    await expect(configToggle(page)).toHaveAttribute("title", "Configure fields");

    await selectItem(page, 801);
    const idPill = detailsPanel(page).getByText("#801", { exact: true });
    const [idBox, toggleBox] = await Promise.all([boxOf(idPill), boxOf(configToggle(page))]);
    expect(toggleBox.x).toBeGreaterThan(idBox.x + idBox.width - 1);
    expect(Math.abs(toggleBox.width - 32)).toBeLessThanOrEqual(1);
    expect(Math.abs(toggleBox.height - 32)).toBeLessThanOrEqual(1);

    await setDetailsPanelWidth(page, 150, { exact: false });
    await expect(detailsPanel(page)).toContainText("Details hidden");
    await expect(configToggle(page)).toHaveCount(0);
  });

  test("DPF-16 without a selected item the empty hint shows and the gear still opens the configuration", async ({ page }) => {
    await mountAndLoad(page);

    await expect(detailsPanel(page)).toContainText("Select a work item to edit its fields.");
    await openConfig(page);
    await expect(shownList(page)).toBeVisible();
  });

  test("DPF-02 popup opens below the gear, toggles, closes on Escape and outside click, and applies changes live", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);

    await expect(configToggle(page)).toHaveAttribute("aria-expanded", "false");
    await openConfig(page);
    await expect(configToggle(page)).toHaveAttribute("aria-expanded", "true");
    const [toggleBox, dialogBox] = await Promise.all([boxOf(configToggle(page)), boxOf(configDialog(page))]);
    expect(dialogBox.y).toBeGreaterThanOrEqual(toggleBox.y + toggleBox.height);
    expect(Math.abs(dialogBox.x + dialogBox.width - (toggleBox.x + toggleBox.width))).toBeLessThanOrEqual(2);

    await configToggle(page).click();
    await expect(configDialog(page)).toBeHidden();
    await expect(configToggle(page)).toHaveAttribute("aria-expanded", "false");

    await openConfig(page);
    await page.keyboard.press("Escape");
    await expect(configDialog(page)).toBeHidden();

    await openConfig(page);
    await page.getByLabel("timeline-pane").click({ position: { x: 5, y: 5 } });
    await expect(configDialog(page)).toBeHidden();

    await openConfig(page);
    await expect(fieldBlock(page, "Story Points")).toHaveCount(1);
    await shownItem(page, "Story Points").getByRole("button", { name: "Remove Story Points" }).click();
    await expect(fieldBlock(page, "Story Points")).toHaveCount(0);
    await expect(configDialog(page).getByRole("button", { name: /^(Apply|Save|OK)$/ })).toHaveCount(0);
  });

  test("DPF-03 DPF-08 shown and available sections, alphabetical available list, search, add and remove", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    await openConfig(page);

    await expect(configDialog(page).getByText("Shown", { exact: true })).toBeVisible();
    await expect(configDialog(page).getByText("Available", { exact: true })).toBeVisible();
    await expect(shownCountHeader(page)).toHaveText(new RegExp(`^\\s*Shown\\s*${DEFAULT_FIELD_ORDER.length}\\s*$`));

    const available = await availableFieldNames(page);
    expect(available.length).toBeGreaterThan(3);
    expect(available).toEqual([...available].sort((left, right) => left.localeCompare(right)));
    expect(available).not.toContain("Story Points");

    const search = configDialog(page).getByPlaceholder("Search field");
    await search.fill("vsts.common.PRIO");
    await expect(availableList(page).getByRole("listitem")).toHaveCount(1);
    await expect(availableItem(page, "Priority")).toBeVisible();
    await search.fill("value AREA");
    await expect(availableItem(page, "Value Area")).toBeVisible();
    await search.fill("zzz-not-a-field");
    await expect(configDialog(page)).toContainText("No matching field.");
    await search.fill("");

    await addFieldViaConfig(page, "Priority");
    const shown = await shownFieldNames(page);
    expect(shown[shown.length - 1]).toBe("Priority");
    await expect(availableItem(page, "Priority")).toHaveCount(0);
    await expect(shownCountHeader(page)).toHaveText(new RegExp(`^\\s*Shown\\s*${DEFAULT_FIELD_ORDER.length + 1}\\s*$`));
    const labels = await panelFieldLabels(page);
    expect(labels[labels.length - 1]).toBe("Priority");

    await shownItem(page, "Priority").getByRole("button", { name: "Remove Priority" }).click();
    await expect(shownItem(page, "Priority")).toHaveCount(0);
    await expect(availableItem(page, "Priority")).toHaveCount(1);
    expect(await panelFieldLabels(page)).not.toContain("Priority");
  });

  test("DPF-04 catalog combines built-ins with live Azure DevOps definitions for the query's work item types without duplicates", async ({ page }) => {
    await mountAndLoad(page, {
      responses: [buildResponse(QUERY_A, buildTimeline({ storyPoints: null }))]
    });
    await selectItem(page, 801);
    await openConfig(page);

    const all = [...(await shownFieldNames(page)), ...(await availableFieldNames(page))];
    for (const builtIn of ["Title", "State", "Description", "Assigned To", "Start", "End", "ID", "Work Item Type", "Dependencies"]) {
      expect(all.filter((name) => name === builtIn)).toHaveLength(1);
    }
    for (const azureField of ["Story Points", "Priority", "Remaining Work", "Value Area", "Area Path", "Tags", "Created Date", "Blocked", "Notes", "Acceptance Criteria"]) {
      expect(all.filter((name) => name === azureField)).toHaveLength(1);
    }
    for (const duplicateName of ["Start Date", "Target Date"]) {
      expect(all).not.toContain(duplicateName);
    }
    const allItemTexts = [
      ...(await shownList(page).getByRole("listitem").allTextContents()),
      ...(await availableList(page).getByRole("listitem").allTextContents())
    ];
    for (const ref of [REF.startDate, REF.targetDate, REF.id, REF.workItemType, REF.title, REF.state, REF.description, REF.assignedTo]) {
      expect(allItemTexts.filter((text) => text.includes(ref)).length).toBeLessThanOrEqual(1);
    }
    await expect(shownItem(page, "Story Points")).toContainText(REF.storyPoints);
    await expect(fieldBlock(page, "Story Points")).toHaveCount(1);

    const requests = JSON.stringify((await readHarness(page)).fieldDefinitionRequests);
    expect(requests).toContain("User Story");
    expect(requests).toContain("Bug");
  });

  test("DPF-05 unavailable definitions fall back to loaded fields shown read-only and full width with a notice", async ({ page }) => {
    await mountAndLoad(page, { fieldDefinitions: { error: "TF400813: not authorized" } });
    await selectItem(page, 801);
    await openConfig(page);

    await expect(configDialog(page)).toContainText("Field definitions unavailable – showing loaded fields read-only.");
    const fallbackNames = [...(await shownFieldNames(page)), ...(await availableFieldNames(page))];
    for (const builtIn of ["Title", "State", "Description", "Assigned To", "Start", "End", "ID", "Work Item Type", "Dependencies"]) {
      expect(fallbackNames.filter((name) => name === builtIn)).toHaveLength(1);
    }
    const fallbackTexts = [
      ...(await shownList(page).getByRole("listitem").allTextContents()),
      ...(await availableList(page).getByRole("listitem").allTextContents())
    ];
    for (const ref of [REF.assignedTo, REF.workItemType]) {
      expect(fallbackTexts.filter((text) => text.includes(ref)).length).toBeLessThanOrEqual(1);
    }
    await expect(shownItem(page, "Title")).toContainText("Edit");
    const priority = availableList(page).getByRole("listitem").filter({ hasText: REF.priority });
    await expect(priority).toHaveCount(1);
    await expect(priority).toContainText("Full");
    await expect(priority).not.toContainText("Edit");
    await priority.getByRole("button", { name: /^Show / }).click();
    await closeConfig(page);

    const lastBlock = fieldBlocks(page).last();
    await expect(lastBlock).toContainText("2");
    await expect(lastBlock.locator("input, select, textarea, [contenteditable='true']")).toHaveCount(0);
    await expectFullWidth(lastBlock, detailsPanel(page));
  });

  test("DPF-06 shown entries show grip, name, reference, width badge, edit badge and move/remove buttons", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    await openConfig(page);

    const title = shownItem(page, "Title");
    await expect(title).toContainText("Built-in");
    await expect(title).toContainText("Full");
    await expect(title).toContainText("Edit");
    await expect(title.locator("svg").first()).toBeVisible();
    await expect(title.getByRole("button", { name: "Move Title up" })).toBeDisabled();
    await expect(title.getByRole("button", { name: "Move Title down" })).toBeEnabled();
    await expect(title.getByRole("button", { name: "Remove Title" })).toBeEnabled();

    const storyPoints = shownItem(page, "Story Points");
    await expect(storyPoints).toContainText(REF.storyPoints);
    await expect(storyPoints).toContainText("½");
    await expect(storyPoints).toContainText("Edit");

    const start = shownItem(page, "Start");
    await expect(start).toContainText("½");
    await expect(start).not.toContainText("Edit");

    const description = shownItem(page, "Description");
    await expect(description.getByRole("button", { name: "Move Description down" })).toBeDisabled();
    await expect(description.getByRole("button", { name: "Move Description up" })).toBeEnabled();
  });

  test("DPF-07 reorder via buttons, Alt+Arrow keys with focus kept, and drag and drop", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    await openConfig(page);

    await shownItem(page, "Story Points").getByRole("button", { name: "Move Story Points up" }).click();
    expect((await shownFieldNames(page)).slice(4, 6)).toEqual(["Story Points", "End"]);
    expect((await panelFieldLabels(page)).slice(4, 6)).toEqual(["Story Points", "End"]);

    await shownItem(page, "Story Points").getByRole("button", { name: "Move Story Points down" }).click();
    expect((await shownFieldNames(page)).slice(4, 6)).toEqual(["End", "Story Points"]);

    await shownItem(page, "Description").focus();
    await page.keyboard.press("Alt+ArrowUp");
    expect((await shownFieldNames(page)).slice(-2)).toEqual(["Description", "Dependencies"]);
    await expect(shownItem(page, "Description")).toBeFocused();
    await page.keyboard.press("Alt+ArrowUp");
    expect((await shownFieldNames(page)).slice(-3)).toEqual(["Description", "Story Points", "Dependencies"]);
    await expect(shownItem(page, "Description")).toBeFocused();
    await page.keyboard.press("Alt+ArrowDown");
    expect((await shownFieldNames(page)).slice(-3)).toEqual(["Story Points", "Description", "Dependencies"]);

    const dropTargetColors = (item: Locator) =>
      item.evaluate((element) =>
        [element, ...element.querySelectorAll("*")]
          .map((node) => {
            const style = getComputedStyle(node);
            return [
              style.boxShadow,
              getComputedStyle(node, "::before").backgroundColor,
              getComputedStyle(node, "::after").backgroundColor
            ].join(" ");
          })
          .join(" | ")
      );
    await configDialog(page).evaluate((dialog) => {
      dialog.scrollTop = 0;
    });
    const dragSource = await boxOf(shownItem(page, "Dependencies"));
    const dragTarget = await boxOf(shownItem(page, "Title"));
    await page.mouse.move(dragTarget.x + 20, dragTarget.y + 3);
    const colorsBeforeDrag = await dropTargetColors(shownItem(page, "Title"));
    expect(colorsBeforeDrag).not.toContain(PRIMARY_RGB);
    await page.mouse.move(dragSource.x + 20, dragSource.y + dragSource.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragTarget.x + 20, dragTarget.y + dragTarget.height / 2, { steps: 8 });
    await page.mouse.move(dragTarget.x + 20, dragTarget.y + 3, { steps: 4 });
    expect(await dropTargetColors(shownItem(page, "Title"))).toContain(PRIMARY_RGB);
    await page.mouse.up();
    expect(await dropTargetColors(shownList(page).getByRole("listitem").nth(1))).not.toContain(PRIMARY_RGB);
    expect((await shownFieldNames(page))[0]).toBe("Dependencies");
    expect((await panelFieldLabels(page))[0]).toBe("Dependencies");
  });

  test("DPF-09 DPF-20 default configuration on first start and reset to default", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);

    expect(await panelFieldLabels(page)).toEqual(DEFAULT_FIELD_ORDER);

    await openConfig(page);
    expect(await shownFieldNames(page)).toEqual(DEFAULT_FIELD_ORDER);
    await shownItem(page, "Title").getByRole("button", { name: "Remove Title" }).click();
    await addFieldViaConfig(page, "Priority");
    await shownItem(page, "Priority").getByRole("button", { name: "Move Priority up" }).click();
    expect(await shownFieldNames(page)).not.toEqual(DEFAULT_FIELD_ORDER);

    await configDialog(page).getByRole("button", { name: "Reset to default" }).click();
    expect(await shownFieldNames(page)).toEqual(DEFAULT_FIELD_ORDER);
    expect(await panelFieldLabels(page)).toEqual(DEFAULT_FIELD_ORDER);
  });

  test("DPF-10 configured fields missing from the current query stay listed greyed out and are not rendered", async ({ page }) => {
    await mount(page, {
      responses: [buildResponse(QUERY_A), buildResponse(QUERY_B)]
    });
    await runQuery(page, QUERY_A);
    await selectItem(page, 801);
    await configureShownFields(page, ["Title", "Story Points", "Priority"]);

    await page.evaluate(
      (fields) => window.__phase6ConfigureFieldDefinitions({ fields }),
      buildFieldDefinitions().filter((field) => field.referenceName !== REF.storyPoints)
    );
    await runQuery(page, QUERY_B);
    await selectItem(page, 801);
    await openConfig(page);

    const missing = shownList(page).getByRole("listitem").filter({ hasText: REF.storyPoints });
    await expect(missing).toHaveCount(1);
    await expect(missing).toContainText("Not in current query");
    const opacity = await missing.evaluate((element) => Number(getComputedStyle(element).opacity));
    expect(opacity).toBeLessThan(1);
    const itemTexts = await shownList(page).getByRole("listitem").allTextContents();
    expect(itemTexts).toHaveLength(3);
    expect(itemTexts[0]).toContain("Title");
    expect(itemTexts[1]).toContain(REF.storyPoints);
    expect(itemTexts[2]).toContain("Priority");
    expect(await panelFieldLabels(page)).toEqual(["Title", "Priority"]);

    await missing.getByRole("button", { name: /^Remove / }).click();
    await expect(shownList(page).getByRole("listitem").filter({ hasText: REF.storyPoints })).toHaveCount(0);
  });

  test("DPF-11 DPF-15 single grid replaces the old row list and read-only values are formatted", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    await configureShownFields(page, ["Title", "Start", "End", "Dependencies", "Created Date", "Area Path", "ID", "Work Item Type"]);

    await expect(detailsPanel(page).locator(".timeline-details-row")).toHaveCount(0);
    await expect(detailsPanel(page).locator(".timeline-details-list")).toHaveCount(0);

    await expect(fieldBlock(page, "Start")).toContainText(formatLocalDateTime("2026-03-02T08:00:00.000Z"));
    await expect(fieldBlock(page, "End")).toContainText(formatLocalDateTime("2026-03-06T16:00:00.000Z"));
    await expect(fieldBlock(page, "End")).toContainText(/from iteration/i);
    await expect(fieldBlock(page, "Created Date")).toContainText(formatLocalDateTime("2026-02-20T09:30:00.000Z"));
    await expect(fieldBlock(page, "Dependencies")).toContainText("0 pred · 1 succ");
    await expect(fieldBlock(page, "ID")).toContainText("801");
    await expect(fieldBlock(page, "Work Item Type")).toContainText("User Story");

    for (const label of ["Start", "End", "Dependencies", "Created Date", "Area Path", "ID", "Work Item Type"]) {
      await expect(fieldBlock(page, label).locator("input, select, textarea, [contenteditable='true']")).toHaveCount(0);
    }

    const areaValue = fieldBlock(page, "Area Path").locator("[title]").filter({ hasText: "Delivery" });
    await expect(areaValue).toHaveAttribute("title", LONG_AREA_PATH);
    const overflow = await areaValue.evaluate((element) => ({
      textOverflow: getComputedStyle(element).textOverflow,
      truncated: element.scrollWidth > element.clientWidth
    }));
    expect(overflow.textOverflow).toBe("ellipsis");
    expect(overflow.truncated).toBe(true);

    await selectItem(page, 802);
    await expect(fieldBlock(page, "Dependencies")).toContainText("1 pred · 0 succ");
  });

  test("DPF-12 automatic widths and pairing rule at two-column panel width", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    await setDetailsPanelWidth(page, 340);
    const panel = detailsPanel(page);

    await expectFullWidth(fieldBlock(page, "Title"), panel);
    await expectSameRow(fieldBlock(page, "State"), fieldBlock(page, "Assigned To"), panel);
    await expectSameRow(fieldBlock(page, "Start"), fieldBlock(page, "End"), panel);
    await expectSameRow(fieldBlock(page, "Story Points"), fieldBlock(page, "Dependencies"), panel);
    await expectFullWidth(fieldBlock(page, "Description"), panel);

    await configureShownFields(page, ["Title", "Story Points", "Notes", "Priority", "Value Area", "Blocked", "Created Date", "Area Path", "Tags"]);
    await expectFullWidth(fieldBlock(page, "Story Points"), panel);
    await expectFullWidth(fieldBlock(page, "Notes"), panel);
    await expectSameRow(fieldBlock(page, "Priority"), fieldBlock(page, "Value Area"), panel);
    await expectSameRow(fieldBlock(page, "Blocked"), fieldBlock(page, "Created Date"), panel);
    await expectFullWidth(fieldBlock(page, "Area Path"), panel);
    await expectFullWidth(fieldBlock(page, "Tags"), panel);

    await openConfig(page);
    await expect(shownItem(page, "Notes")).toContainText("Full");
    await expect(shownItem(page, "Value Area")).toContainText("½");
    await expect(shownItem(page, "Blocked")).toContainText("½");
    await expect(shownItem(page, "Tags")).toContainText("Full");
    await closeConfig(page);

    await configureShownFields(page, ["Assigned To", "Acceptance Criteria", "ID", "Work Item Type", "Correlation Id", "Changed By"]);
    await expectFullWidth(fieldBlock(page, "Correlation Id"), panel);
    await expectFullWidth(fieldBlock(page, "Changed By"), panel);
    await openConfig(page);
    await expect(shownItem(page, "Correlation Id")).toContainText("Full");
    await expect(shownItem(page, "Changed By")).toContainText("½");
    await closeConfig(page);
    await expectFullWidth(fieldBlock(page, "Assigned To"), panel);
    await expectFullWidth(fieldBlock(page, "Acceptance Criteria"), panel);
    await expectSameRow(fieldBlock(page, "ID"), fieldBlock(page, "Work Item Type"), panel);
  });

  test("DPF-13 narrow panels switch to one column live while resizing", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    const panel = detailsPanel(page);

    await setDetailsPanelWidth(page, 340);
    await expectSameRow(fieldBlock(page, "State"), fieldBlock(page, "Assigned To"), panel);
    const callsBefore = (await readHarness(page)).callLog.length;

    await setDetailsPanelWidth(page, 270);
    for (const label of DEFAULT_FIELD_ORDER) {
      await expectFullWidth(fieldBlock(page, label), panel);
    }
    const stateBox = await boxOf(fieldBlock(page, "State"));
    const assigneeBox = await boxOf(fieldBlock(page, "Assigned To"));
    expect(assigneeBox.y).toBeGreaterThan(stateBox.y + stateBox.height - 1);

    await setDetailsPanelWidth(page, 340);
    await expectSameRow(fieldBlock(page, "State"), fieldBlock(page, "Assigned To"), panel);

    await setDetailsContentWidth(page, 285);
    await expectSameRow(fieldBlock(page, "State"), fieldBlock(page, "Assigned To"), panel);
    await setDetailsContentWidth(page, 275);
    await expectFullWidth(fieldBlock(page, "State"), panel);
    await expectFullWidth(fieldBlock(page, "Assigned To"), panel);
    expect((await readHarness(page)).callLog.length).toBe(callsBefore);
  });

  test("DPF-14 empty values show a dash and fields undefined for the item type are hidden", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    await configureShownFields(page, ["Title", "Story Points", "Remaining Work", "Priority", "Notes"]);

    expect(await panelFieldLabels(page)).toEqual(["Title", "Story Points", "Priority", "Notes"]);
    await setDetailsPanelWidth(page, 340);
    await expectSameRow(fieldBlock(page, "Story Points"), fieldBlock(page, "Priority"), detailsPanel(page));

    await selectItem(page, 802);
    expect(await panelFieldLabels(page)).toEqual(["Title", "Remaining Work", "Priority", "Notes"]);
    const priorityInput = fieldBlock(page, "Priority").getByLabel("Priority");
    await expect(priorityInput).toHaveValue("");
    await expect(priorityInput).toHaveAttribute("placeholder", "—");
    await expect(fieldBlock(page, "Notes").getByLabel("Notes")).toHaveValue("");
    await expect(fieldBlock(page, "Notes").getByLabel("Notes")).toHaveAttribute("placeholder", "—");

    await configureShownFields(page, ["Title", "Area Path", "Acceptance Criteria", "Created Date"]);
    for (const label of ["Area Path", "Acceptance Criteria", "Created Date"]) {
      const dash = fieldBlock(page, label).getByText("—", { exact: true });
      await expect(dash).toBeVisible();
      await expect(dash).toHaveCSS("color", MUTED_TEXT_LIGHT_RGB);
    }

    await selectItem(page, 801);
    const readOnlyBox = fieldBlock(page, "Created Date").locator("[title]").first();
    await expect(readOnlyBox).toHaveCSS("border-top-style", "dashed");
  });

  test("DPF-17 editable field types render the matching controls and the rest stays read-only", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    await configureShownFields(page, [
      "Title",
      "Notes",
      "Story Points",
      "Priority",
      "Value Area",
      "State",
      "Blocked",
      "Assigned To",
      "Description",
      "Created Date",
      "Tags",
      "Area Path"
    ]);

    await expect(fieldBlock(page, "Title").getByRole("textbox", { name: "Title" })).toHaveValue("Alpha timeline item");
    await expect(fieldBlock(page, "Notes").getByRole("textbox", { name: "Notes" })).toHaveValue("Alpha notes");
    await expect(fieldBlock(page, "Story Points").getByLabel("Story Points")).toHaveValue("5");
    await expect(fieldBlock(page, "Priority").getByLabel("Priority")).toHaveValue("2");

    const valueArea = fieldBlock(page, "Value Area").getByRole("combobox", { name: "Value Area" });
    await expect(valueArea.locator("option")).toHaveText(["Business", "Architectural"]);
    await expect(valueArea).toHaveValue("Business");

    const state = fieldBlock(page, "State").getByRole("combobox", { name: "State" });
    await expect(state).toHaveValue("Active");

    const blocked = fieldBlock(page, "Blocked").getByRole("combobox", { name: "Blocked" });
    expect((await blocked.locator("option").allTextContents()).map((option) => option.trim()).sort()).toEqual(["No", "Yes"]);
    await expect(blocked.locator("option:checked")).toHaveText("No");

    const assignee = fieldBlock(page, "Assigned To").getByRole("combobox", { name: "Assigned To" });
    const assigneeOptions = await assignee.locator("option").allTextContents();
    expect(assigneeOptions).toContain("Unassigned");
    expect(assigneeOptions.some((option) => option.includes("Ada Lovelace"))).toBe(true);
    expect(assigneeOptions.some((option) => option.includes("Grace Hopper"))).toBe(true);

    await expect(fieldBlock(page, "Description")).toContainText("Alpha description");
    await fieldBlock(page, "Description").getByText("Alpha description").click();
    await expect(fieldBlock(page, "Description").locator("[contenteditable='true']")).toHaveCount(1);

    for (const label of ["Created Date", "Tags", "Area Path"]) {
      await expect(fieldBlock(page, label).locator("input, select, textarea, [contenteditable='true']")).toHaveCount(0);
    }

    await configureShownFields(page, ["Title", "External Ref", "Changed By", "Acceptance Criteria"]);
    await expect(fieldBlock(page, "External Ref")).toContainText("EXT-42");
    await expect(fieldBlock(page, "External Ref").locator("input, select, textarea, [contenteditable='true']")).toHaveCount(0);
    await expect(fieldBlock(page, "Changed By")).toContainText("Grace Hopper");
    await expect(fieldBlock(page, "Changed By").locator("input, select, textarea, [contenteditable='true']")).toHaveCount(0);
    await fieldBlock(page, "Acceptance Criteria").getByText("Alpha criteria").click();
    await expect(fieldBlock(page, "Acceptance Criteria").locator("[contenteditable='true']")).toHaveCount(1);

    await openConfig(page);
    await expect(shownItem(page, "External Ref")).not.toContainText("Edit");
    await expect(shownItem(page, "Changed By")).not.toContainText("Edit");
    await expect(shownItem(page, "Acceptance Criteria")).toContainText("Edit");
    await closeConfig(page);
  });

  test("DPF-18 number validation, comma input, clearing and integer rules", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);
    await configureShownFields(page, ["Title", "Story Points", "Priority"]);
    const save = detailsPanel(page).getByRole("button", { name: "Save" });
    const storyPoints = fieldBlock(page, "Story Points").getByLabel("Story Points");
    const priority = fieldBlock(page, "Priority").getByLabel("Priority");
    const doubleError = "Enter a number ≥ 0 with up to 2 decimals.";
    const integerError = "Enter a whole number ≥ 0.";

    for (const invalid of ["-1", "1.234", "abc"]) {
      await storyPoints.fill(invalid);
      await expect(fieldBlock(page, "Story Points")).toContainText(doubleError);
      await expect(storyPoints).toHaveAttribute("aria-invalid", "true");
      const borderColor = await storyPoints.evaluate((element) => getComputedStyle(element).borderTopColor);
      expect(borderColor).toMatch(/^rgb\((1[5-9]\d|2\d\d), ([0-9]{1,2}|1[0-2]\d), ([0-9]{1,2}|1[0-2]\d)\)$/);
      await expect(save).toBeDisabled();
    }

    await storyPoints.fill("1,25");
    await expect(fieldBlock(page, "Story Points")).not.toContainText(doubleError);
    await expect(save).toBeEnabled();

    await priority.fill("-1");
    await expect(fieldBlock(page, "Priority")).toContainText(integerError);
    await expect(save).toBeDisabled();
    await priority.fill("2");

    await storyPoints.fill("3,5");
    await expect(fieldBlock(page, "Story Points")).not.toContainText(doubleError);
    await expect(save).toBeEnabled();

    await priority.fill("2.5");
    await expect(fieldBlock(page, "Priority")).toContainText(integerError);
    await expect(save).toBeDisabled();
    await priority.fill("3");
    await expect(fieldBlock(page, "Priority")).not.toContainText(integerError);

    await save.click();
    let update = lastDetailsUpdate((await readHarness(page)).detailsUpdates);
    expect(update.targetWorkItemId).toBe(801);
    expect(update.fields?.[REF.storyPoints]).toBe(3.5);
    expect(update.fields?.[REF.priority]).toBe(3);

    await storyPoints.fill("");
    await expect(save).toBeEnabled();
    await save.click();
    update = lastDetailsUpdate((await readHarness(page)).detailsUpdates);
    expect(update.fields).toHaveProperty([REF.storyPoints], null);
  });

  test("DPF-19 dirty markers, single combined save, keyboard save, live timeline update, failure and unsaved guard", async ({ page }) => {
    await mountAndLoad(page, {
      preferences: harnessPreferences({
        queryScopedTimelinePreferencesByQueryId: {
          [QUERY_A]: { timelineSidebarFields: [REF.storyPoints] }
        }
      })
    });
    await selectItem(page, 801);
    const save = detailsPanel(page).getByRole("button", { name: "Save" });
    const storyPoints = fieldBlock(page, "Story Points").getByLabel("Story Points");
    const title = fieldBlock(page, "Title").getByRole("textbox", { name: "Title" });

    await expect(page.getByLabel("timeline-sidebar-row-801")).toContainText("5");
    await expect(save).toBeDisabled();

    await storyPoints.fill("8");
    await page.getByRole("button", { name: "Refresh" }).first().click();
    await expect(page.getByRole("alertdialog")).toContainText("Warning: Unsaved changes");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    await expect(storyPoints).toHaveValue("8");

    await title.fill("Alpha renamed");
    const markerContent = await fieldBlock(page, "Story Points")
      .locator(".timeline-details-label")
      .evaluate((element) => getComputedStyle(element, "::after").content);
    expect(markerContent).toContain("•");
    const markerColor = await fieldBlock(page, "Story Points")
      .locator(".timeline-details-label")
      .evaluate((element) => getComputedStyle(element, "::after").color);
    expect(markerColor).toBe(PRIMARY_RGB);
    const untouchedMarker = await fieldBlock(page, "State")
      .locator(".timeline-details-label")
      .evaluate((element) => getComputedStyle(element, "::after").content);
    expect(untouchedMarker).not.toContain("•");

    const callsBefore = (await readHarness(page)).callLog.length;
    const updatesBefore = (await readHarness(page)).detailsUpdates.length;
    await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
    await expect(save).toBeDisabled();

    const harness = await readHarness(page);
    expect(harness.detailsUpdates.length).toBe(updatesBefore + 1);
    const update = lastDetailsUpdate(harness.detailsUpdates);
    expect(update.targetWorkItemId).toBe(801);
    expect(update.fields?.[REF.storyPoints]).toBe(8);
    expect(update.fields?.[REF.title]).toBe("Alpha renamed");
    expect(harness.callLog.length).toBe(callsBefore);

    await expect(page.getByLabel("timeline-sidebar-row-801")).toContainText("8");
    await expect(page.getByLabel("timeline-sidebar-row-801")).not.toContainText(/\b5\b/);
    await selectItem(page, 802);
    await selectItem(page, 801);
    await expect(fieldBlock(page, "Story Points").getByLabel("Story Points")).toHaveValue("8");

    await page.evaluate(() => window.__phase6FailNextDetailsUpdate("TF401320: Story Points update denied"));
    await fieldBlock(page, "Story Points").getByLabel("Story Points").fill("13");
    await save.click();
    await expect(detailsPanel(page)).toContainText("Save failed: TF401320: Story Points update denied");
    await expect(fieldBlock(page, "Story Points").getByLabel("Story Points")).toHaveValue("13");
    await expect(save).toBeEnabled();
  });

  test("DPF-19 saved values update bar labels and color coding without a full reload", async ({ page }) => {
    await mountAndLoad(page, {
      preferences: harnessPreferences({
        queryScopedTimelinePreferencesByQueryId: {
          [QUERY_A]: {
            timelineLabelFields: [REF.storyPoints],
            timelineColorCoding: "field",
            timelineFieldColorCoding: {
              fieldRef: REF.storyPoints,
              valueColors: {
                [`${REF.storyPoints}::5`]: "#2563eb",
                [`${REF.storyPoints}::8`]: "#dc2626"
              }
            }
          }
        }
      })
    });
    await selectItem(page, 801);
    const bar = page.getByLabel("timeline-bar-801");
    const barLabel = page.getByLabel("timeline-pane").locator("svg text").filter({ hasText: /^5$/ });
    await expect(barLabel).toHaveCount(1);
    await expect(bar).toHaveCSS("fill", "rgb(37, 99, 235)");
    const callsBefore = (await readHarness(page)).callLog.length;

    await fieldBlock(page, "Story Points").getByLabel("Story Points").fill("8");
    await detailsPanel(page).getByRole("button", { name: "Save" }).click();

    await expect(bar).toHaveCSS("fill", "rgb(220, 38, 38)");
    await expect(page.getByLabel("timeline-pane").locator("svg text").filter({ hasText: /^8$/ })).toHaveCount(1);
    await expect(page.getByLabel("timeline-pane").locator("svg text").filter({ hasText: /^5$/ })).toHaveCount(0);
    expect((await readHarness(page)).callLog.length).toBe(callsBefore);
  });

  test("DPF-19 saved values re-evaluate active field filters without a full reload", async ({ page }) => {
    await page.goto(`${HARNESS_HTML_URL}?tf=${encodeURIComponent(`${encodeURIComponent(REF.storyPoints)}~5`)}`);
    await mount(page, { keepUrl: true });
    await runQuery(page, QUERY_A);
    await expect(page.getByLabel("timeline-sidebar-row-802")).toHaveCount(0);
    await selectItem(page, 801);
    const callsBefore = (await readHarness(page)).callLog.length;

    await fieldBlock(page, "Story Points").getByLabel("Story Points").fill("8");
    await detailsPanel(page).getByRole("button", { name: "Save" }).click();

    await expect(page.getByLabel("timeline-sidebar-row-801")).toHaveCount(0);
    expect((await readHarness(page)).callLog.length).toBe(callsBefore);
  });

  test("DPF-21 configuration persists globally across remount and query switch", async ({ page }) => {
    await mount(page, { responses: [buildResponse(QUERY_A), buildResponse(QUERY_B)] });
    await runQuery(page, QUERY_A);
    await selectItem(page, 801);
    await configureShownFields(page, ["Story Points", "Title", "Priority"]);
    expect(await panelFieldLabels(page)).toEqual(["Story Points", "Title", "Priority"]);

    await expect
      .poll(async () => {
        const stored = await readStoredPreferences(page);
        const scoped = JSON.stringify(stored.queryScopedTimelinePreferencesByQueryId ?? {});
        const topLevelArrays = Object.entries(stored)
          .filter(([key]) => key !== "queryScopedTimelinePreferencesByQueryId")
          .map(([, value]) => value)
          .filter((value): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string"));
        const config = topLevelArrays.find((value) => value.includes(REF.storyPoints) && value.includes(REF.priority));
        return {
          ordered: !!config && config.indexOf(REF.storyPoints) < config.indexOf(REF.priority) && config.length === 3,
          scopedContainsConfig: scoped.includes(REF.priority)
        };
      })
      .toEqual({ ordered: true, scopedContainsConfig: false });

    await runQuery(page, QUERY_B);
    await selectItem(page, 801);
    expect(await panelFieldLabels(page)).toEqual(["Story Points", "Title", "Priority"]);

    await mount(page, { responses: [buildResponse(QUERY_A)], resetPreferences: false });
    await runQuery(page, QUERY_A);
    await selectItem(page, 801);
    expect(await panelFieldLabels(page)).toEqual(["Story Points", "Title", "Priority"]);
  });

  test("DPF-22 keyboard operation, accessible labels and dark theme tokens", async ({ page }) => {
    await mountAndLoad(page);
    await selectItem(page, 801);

    await configToggle(page).focus();
    await page.keyboard.press("Enter");
    await expect(configDialog(page)).toBeVisible();
    await expect(shownList(page)).toBeVisible();
    await expect(availableList(page)).toBeVisible();
    await expect(configDialog(page).getByRole("searchbox", { name: "Search details fields" })).toBeVisible();

    const focusedLabels: string[] = [];
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element) {
          return { inDialog: false, label: "", outline: "none", shadow: "none" };
        }
        const style = getComputedStyle(element);
        return {
          inDialog: !!element.closest("[role='dialog']"),
          label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
          outline: style.outlineStyle,
          shadow: style.boxShadow
        };
      });
      expect(info.inDialog).toBe(true);
      expect(info.outline !== "none" || info.shadow !== "none").toBe(true);
      focusedLabels.push(info.label);
    }
    expect(focusedLabels.some((label) => label === "Reset to default")).toBe(true);
    expect(focusedLabels.some((label) => /^Move .+ (up|down)$/.test(label) || /^Remove .+$/.test(label))).toBe(true);

    await page.evaluate(() => {
      document.documentElement.dataset.themeMode = "light";
      document.documentElement.dataset.theme = "light";
    });
    await expect(configDialog(page)).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(fieldBlock(page, "Title").getByRole("textbox", { name: "Title" })).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      document.documentElement.dataset.themeMode = "dark";
      document.documentElement.dataset.theme = "dark";
    });
    await openConfig(page);
    const colors = await configDialog(page).evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: getComputedStyle(element.querySelector("strong") ?? element).color };
    });
    expect(colors.background).toBe("rgb(28, 25, 23)");
    expect(colors.color).toBe("rgb(250, 250, 249)");
    const inputBackground = await fieldBlock(page, "Title")
      .getByRole("textbox", { name: "Title" })
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(inputBackground).toBe("rgb(28, 25, 23)");
  });
});
