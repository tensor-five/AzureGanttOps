import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";

import {
  createUiShellComposition,
  type AdoCommLogEntry,
  type UiShellComposition
} from "../composition/ui-shell.composition.js";
import { TopTabs } from "../../features/navigation/top-tabs.js";
import type { TabId } from "../../shared/ui-state/tab-id.js";
import { QuerySelector, ORG_KEY, PROJECT_KEY, QUERY_INPUT_KEY, resolveQueryRunInput } from "../../features/query-switching/query-selector.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import { MappingFixPanel } from "../../features/field-mapping/mapping-fix-panel.js";
import { TimelinePane, applyAdoptedSchedules } from "../../features/gantt-view/timeline-pane.js";
import { createTimelineSelectionStore } from "../../features/gantt-view/selection-store.js";
import { WarningBanner } from "../../features/diagnostics/warning-banner.js";
import { TrustBadge } from "../../features/diagnostics/trust-badge.js";
import { DiagnosticsTab } from "../../features/diagnostics/diagnostics-tab.js";
import { mapQueryIntakeResponseToUiModel, type QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";

const ADO_COMM_LOG_POLL_INTERVAL_MS = 3000;
const ADO_COMM_LOG_READ_LIMIT = 200;
const ADO_COMM_LOG_UI_MAX = 1000;
const UI_SHELL_STATE_KEY = "azure-ganttops.ui-shell-state.v1";
const THEME_MODE_KEY = "azure-ganttops.theme-mode.v1";

type ThemeMode = "system" | "light" | "dark";
type WorkItemSyncState = "up_to_date" | "syncing" | "error";

function applyScheduleUpdate(
  timeline: QueryIntakeResponse["timeline"],
  targetWorkItemId: number,
  startDate: string,
  endDate: string
): QueryIntakeResponse["timeline"] {
  const adopted = applyAdoptedSchedules(timeline, {
    [targetWorkItemId]: { startDate, endDate }
  });
  if (!adopted) {
    return adopted;
  }

  return {
    ...adopted,
    bars: adopted.bars.map((bar) =>
      bar.workItemId === targetWorkItemId
        ? {
            ...bar,
            schedule: {
              startDate,
              endDate,
              missingBoundary: null
            }
          }
        : bar
    )
  };
}

function applyWorkItemMetadataUpdate(
  timeline: QueryIntakeResponse["timeline"],
  targetWorkItemId: number,
  title: string,
  descriptionHtml: string,
  stateCode: string,
  stateColor: string | null
): QueryIntakeResponse["timeline"] {
  if (!timeline) {
    return timeline;
  }

  const nextState = toTimelineStateBadge(stateCode, stateColor);

  return {
    ...timeline,
    bars: timeline.bars.map((bar) =>
      bar.workItemId === targetWorkItemId
        ? {
            ...bar,
            title,
            state: nextState,
            details: {
              ...bar.details,
              descriptionHtml
            }
          }
        : bar
    ),
    unschedulable: timeline.unschedulable.map((item) =>
      item.workItemId === targetWorkItemId
        ? {
            ...item,
            title,
            state: nextState,
            details: {
              ...item.details,
              descriptionHtml
            }
          }
        : item
    )
  };
}

function toTimelineStateBadge(code: string, preferredColor: string | null): { code: string; badge: string; color: string } {
  const normalizedCode = code.trim().length > 0 ? code.trim() : "Unknown";
  return {
    code: normalizedCode,
    badge: normalizedCode.charAt(0).toUpperCase() || "?",
    color: preferredColor && preferredColor.trim().length > 0 ? `#${preferredColor.replace(/^#/, "")}` : colorForStateCode(normalizedCode)
  };
}

function colorForStateCode(code: string): string {
  switch (code.toLowerCase()) {
    case "new":
    case "to do":
      return "#7c3aed";
    case "active":
    case "in progress":
      return "#1d4ed8";
    case "resolved":
      return "#15803d";
    case "closed":
    case "done":
      return "#6b7280";
    default:
      return "#334155";
  }
}

function resolveStatePaletteSourceWorkItemId(timeline: QueryIntakeResponse["timeline"]): number | null {
  if (!timeline) {
    return null;
  }

  const firstBarId = timeline.bars[0]?.workItemId ?? null;
  if (typeof firstBarId === "number") {
    return firstBarId;
  }

  const firstUnscheduledId = timeline.unschedulable[0]?.workItemId ?? null;
  return typeof firstUnscheduledId === "number" ? firstUnscheduledId : null;
}

function normalizeWorkItemType(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function collectStatePaletteSourceWorkItemsByType(timeline: QueryIntakeResponse["timeline"]): Map<string, number> {
  const result = new Map<string, number>();
  if (!timeline) {
    return result;
  }

  const register = (workItemId: number, workItemType: string | null | undefined): void => {
    const typeKey = normalizeWorkItemType(workItemType);
    if (!typeKey || result.has(typeKey)) {
      return;
    }

    result.set(typeKey, workItemId);
  };

  timeline.bars.forEach((bar) => {
    register(bar.workItemId, bar.details.workItemType);
  });
  timeline.unschedulable.forEach((item) => {
    register(item.workItemId, item.details.workItemType);
  });

  return result;
}

function normalizeAdoStateColor(color: string | null): string | null {
  if (!color) {
    return null;
  }

  const normalized = color.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : null;
}

function buildStateColorLookup(states: Array<{ name: string; color: string | null }>): Map<string, string> {
  const colorByStateCode = new Map<string, string>();
  states.forEach((state) => {
    const name = state.name.trim().toLowerCase();
    const color = normalizeAdoStateColor(state.color);
    if (name.length > 0 && color) {
      colorByStateCode.set(name, color);
    }
  });

  return colorByStateCode;
}

function applyRuntimeStateColorsByType(
  timeline: QueryIntakeResponse["timeline"],
  stateColorsByType: ReadonlyMap<string, ReadonlyMap<string, string>>,
  fallbackStateColors: ReadonlyMap<string, string>
): QueryIntakeResponse["timeline"] {
  if (!timeline) {
    return timeline;
  }

  const resolveColor = (input: { stateCode: string; workItemType: string | null | undefined }): string | null => {
    const stateKey = input.stateCode.trim().toLowerCase();
    if (stateKey.length === 0) {
      return null;
    }

    const typeKey = normalizeWorkItemType(input.workItemType);
    const typeScoped = typeKey ? stateColorsByType.get(typeKey)?.get(stateKey) : null;
    return typeScoped ?? fallbackStateColors.get(stateKey) ?? null;
  };

  return {
    ...timeline,
    bars: timeline.bars.map((bar) => {
      const nextColor = resolveColor({
        stateCode: bar.state.code,
        workItemType: bar.details.workItemType
      });
      return nextColor ? { ...bar, state: { ...bar.state, color: nextColor } } : bar;
    }),
    unschedulable: timeline.unschedulable.map((item) => {
      const nextColor = resolveColor({
        stateCode: item.state.code,
        workItemType: item.details.workItemType
      });
      return nextColor ? { ...item, state: { ...item.state, color: nextColor } } : item;
    })
  };
}

type RunRequest = {
  queryInput: string;
  mappingProfileId?: string;
  mappingProfileUpsert?: {
    id: string;
    name: string;
    fields: {
      id: string;
      title: string;
      start: string;
      endOrTarget: string;
    };
  };
};

function renderAdoCommLogPanel(params: {
  logs: AdoCommLogEntry[];
  loading: boolean;
  error: string | null;
}): React.ReactElement {
  return React.createElement(
    "details",
    {
      "aria-label": "ado-communication-log-panel",
      className: "ado-communication-log-panel",
      open: true
    },
    React.createElement("summary", null, "Azure DevOps API logs"),
    params.loading ? React.createElement("div", null, "Loading communication logs…") : null,
    params.error ? React.createElement("div", null, `Log stream error: ${params.error}`) : null,
    React.createElement(
      "div",
      { className: "ado-communication-log-list" },
      params.logs.length === 0
        ? React.createElement("div", null, "No Azure communication entries yet.")
        : params.logs.map((entry) =>
            React.createElement(
              "pre",
              {
                key: `${entry.seq}-${entry.direction}`,
                "aria-label": "ado-log-entry",
                className: "ado-communication-log-entry"
              },
              `[${entry.seq}] ${entry.timestamp} ${entry.direction.toUpperCase()} ${entry.method} ${entry.url} status=${entry.status ?? "-"} durationMs=${entry.durationMs ?? "-"} ${entry.preview}`
            )
          )
    )
  );
}

export type UiBootstrapOptions = {
  container: HTMLElement;
  composition: UiShellComposition;
};

export function bootstrapUiClient(options: UiBootstrapOptions): void {
  const root = createRoot(options.container);

  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(
        QueryClientProvider,
        {
          client: options.composition.queryClient
        },
        React.createElement(
          BrowserRouter,
          null,
          React.createElement(UiShellApp, {
            composition: options.composition
          })
        )
      )
    )
  );
}

export function createDefaultUiShellComposition(params: Parameters<typeof createUiShellComposition>[0]): UiShellComposition {
  return createUiShellComposition(params);
}

function UiShellApp(props: { composition: UiShellComposition }): React.ReactElement {
  const restoredState = React.useMemo(() => readPersistedUiShellState(), []);
  const initialResponse = restoredState?.response ?? null;
  const initialActiveTab: TabId =
    initialResponse && initialResponse.mappingValidation.status === "invalid"
      ? "mapping"
      : (restoredState?.activeTab ?? "query");
  const persistedQueryInput = resolvePersistedRefreshQueryInput();
  const hasInitialQuery = Boolean(persistedQueryInput || initialResponse?.activeQueryId || initialResponse?.selectedQueryId);

  const [activeTab, setActiveTab] = React.useState<TabId>(initialActiveTab);
  const [controlsOpen, setControlsOpen] = React.useState(!hasInitialQuery);
  const [response, setResponse] = React.useState<QueryIntakeResponse | null>(initialResponse);
  const [lastRunRequest, setLastRunRequest] = React.useState<RunRequest | null>(restoredState?.lastRunRequest ?? null);
  const [uiModel, setUiModel] = React.useState<QueryIntakeUiModel>(
    initialResponse ? mapQueryIntakeResponseToUiModel(initialResponse) : createInitialUiModel()
  );
  const [blockerMessage, setBlockerMessage] = React.useState<{
    tab: TabId;
    reason: string;
    nextAction: string;
  } | null>(null);
  const [mappingFixResponse, setMappingFixResponse] = React.useState<QueryIntakeResponse | null>(
    initialResponse && initialResponse.mappingValidation.status === "invalid" ? initialResponse : null
  );
  const [adoCommLogs, setAdoCommLogs] = React.useState<AdoCommLogEntry[]>([]);
  const [adoCommLogsCursor, setAdoCommLogsCursor] = React.useState(0);
  const [adoCommLogsError, setAdoCommLogsError] = React.useState<string | null>(null);
  const [adoCommLogsLoading, setAdoCommLogsLoading] = React.useState(true);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => readPersistedThemeMode());
  const [workItemSyncState, setWorkItemSyncState] = React.useState<WorkItemSyncState>("up_to_date");
  const [workItemSyncError, setWorkItemSyncError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const adoCommPollInFlightRef = React.useRef(false);
  const workItemSyncInFlightRef = React.useRef(0);
  const timelineSelectionStoreRef = React.useRef(createTimelineSelectionStore());
  const workItemStateOptionsCacheRef = React.useRef<Map<number, Array<{ name: string; color: string | null }>>>(new Map());
  const organization = typeof localStorage === "undefined" ? "" : localStorage.getItem(ORG_KEY) ?? "";
  const project = typeof localStorage === "undefined" ? "" : localStorage.getItem(PROJECT_KEY) ?? "";

  const fetchWorkItemStateOptionsCached = React.useCallback(
    async ({ targetWorkItemId }: { targetWorkItemId: number }) => {
      const cached = workItemStateOptionsCacheRef.current.get(targetWorkItemId);
      if (cached) {
        return cached;
      }

      const response = await props.composition.controller.fetchWorkItemStateOptions({ targetWorkItemId });
      workItemStateOptionsCacheRef.current.set(targetWorkItemId, response.states);
      return response.states;
    },
    [props.composition.controller]
  );

  const enrichResponseWithRuntimeStateColors = React.useCallback(
    async (incoming: QueryIntakeResponse): Promise<QueryIntakeResponse> => {
      try {
        const sourceByType = collectStatePaletteSourceWorkItemsByType(incoming.timeline);
        const stateColorsByType = new Map<string, Map<string, string>>();
        const fallbackStateColors = new Map<string, string>();

        if (sourceByType.size > 0) {
          await Promise.all(
            [...sourceByType.entries()].map(async ([typeKey, workItemId]) => {
              const stateOptions = await fetchWorkItemStateOptionsCached({ targetWorkItemId: workItemId });
              const stateColors = buildStateColorLookup(stateOptions);
              if (stateColors.size === 0) {
                return;
              }

              stateColorsByType.set(typeKey, stateColors);
              stateColors.forEach((color, state) => {
                if (!fallbackStateColors.has(state)) {
                  fallbackStateColors.set(state, color);
                }
              });
            })
          );
        } else {
          const fallbackSourceWorkItemId = resolveStatePaletteSourceWorkItemId(incoming.timeline);
          if (fallbackSourceWorkItemId !== null) {
            const stateOptions = await fetchWorkItemStateOptionsCached({ targetWorkItemId: fallbackSourceWorkItemId });
            buildStateColorLookup(stateOptions).forEach((color, state) => {
              fallbackStateColors.set(state, color);
            });
          }
        }

        return {
          ...incoming,
          timeline: applyRuntimeStateColorsByType(incoming.timeline, stateColorsByType, fallbackStateColors)
        };
      } catch {
        return incoming;
      }
    },
    [fetchWorkItemStateOptionsCached]
  );

  React.useEffect(() => {
    let active = true;

    const poll = async () => {
      if (adoCommPollInFlightRef.current || !active) {
        return;
      }

      adoCommPollInFlightRef.current = true;

      try {
        const snapshot = await props.composition.controller.fetchAdoCommLogs({
          afterSeq: adoCommLogsCursor,
          limit: ADO_COMM_LOG_READ_LIMIT
        });

        if (!active) {
          return;
        }

        setAdoCommLogs((current) => {
          const next = current.concat(snapshot.entries);
          if (next.length > ADO_COMM_LOG_UI_MAX) {
            return next.slice(next.length - ADO_COMM_LOG_UI_MAX);
          }

          return next;
        });
        setAdoCommLogsCursor(snapshot.nextSeq);
        setAdoCommLogsError(null);
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load Azure communication logs.";
        setAdoCommLogsError(message);
      } finally {
        if (active) {
          setAdoCommLogsLoading(false);
        }

        adoCommPollInFlightRef.current = false;
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, ADO_COMM_LOG_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [adoCommLogsCursor, props.composition.controller]);

  const runQuery = React.useCallback(
    async (request: {
      queryId: string;
      mappingProfileId?: string;
      mappingProfileUpsert?: {
        id: string;
        name: string;
        fields: {
          id: string;
          title: string;
          start: string;
          endOrTarget: string;
        };
      };
    }): Promise<QueryIntakeResponse> => {
      const result = await props.composition.runQuerySelectionFlow({
        queryId: request.queryId,
        mappingProfileId: request.mappingProfileId,
        mappingProfileUpsert: request.mappingProfileUpsert
      });
      const submitted = await enrichResponseWithRuntimeStateColors(result.response);
      setResponse(submitted);
      setUiModel(mapQueryIntakeResponseToUiModel(submitted));
      setLastRunRequest({
        queryInput: request.queryId,
        mappingProfileId: request.mappingProfileId,
        mappingProfileUpsert: request.mappingProfileUpsert
      });
      setBlockerMessage(null);

      if (
        submitted.preflightStatus === "READY" &&
        submitted.statusCode === "OK" &&
        submitted.mappingValidation.status === "invalid"
      ) {
        setMappingFixResponse(submitted);
        setActiveTab("mapping");
      } else {
        setMappingFixResponse(null);
        setActiveTab("timeline");
      }

      return submitted;
    },
    [enrichResponseWithRuntimeStateColors, props.composition]
  );

  const handleNeedsFix = React.useCallback((needsFixResponse: QueryIntakeResponse) => {
    setMappingFixResponse(needsFixResponse);
    setActiveTab("mapping");
  }, []);

  const applyMappingDefaults = React.useCallback(
    async (selection: {
      id: string;
      title: string;
      start: string;
      endOrTarget: string;
    }) => {
      const nextQueryId = response?.activeQueryId ?? mappingFixResponse?.activeQueryId;
      if (!nextQueryId) {
        return;
      }

      const next = await runQuery({
        queryId: nextQueryId,
        mappingProfileUpsert: {
          id: "auto-required-defaults",
          name: "Required defaults",
          fields: selection
        }
      });

      if (next.mappingValidation.status === "valid") {
        setMappingFixResponse(null);
        setActiveTab("timeline");
      } else {
        setMappingFixResponse(next);
      }
    },
    [mappingFixResponse?.activeQueryId, response?.activeQueryId, runQuery]
  );

  const retryRefresh = React.useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      if (lastRunRequest) {
        const refreshedRaw = await props.composition.controller.submit(lastRunRequest);
        const refreshed = await enrichResponseWithRuntimeStateColors(refreshedRaw);
        setResponse(refreshed);
        setUiModel(mapQueryIntakeResponseToUiModel(refreshed));

        if (
          refreshed.preflightStatus === "READY" &&
          refreshed.statusCode === "OK" &&
          refreshed.mappingValidation.status === "invalid"
        ) {
          setMappingFixResponse(refreshed);
          setActiveTab("mapping");
          setControlsOpen(true);
          return;
        }

        setActiveTab("timeline");
        return;
      }

      const persistedQueryInput = resolvePersistedRefreshQueryInput();
      if (!persistedQueryInput) {
        setActiveTab("query");
        setControlsOpen(true);
        setBlockerMessage({
          tab: "query",
          reason: "No query available to refresh.",
          nextAction: "Open controls, enter Query ID, then run query."
        });
        return;
      }

      await runQuery({
        queryId: persistedQueryInput
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [enrichResponseWithRuntimeStateColors, isRefreshing, lastRunRequest, props.composition.controller, runQuery]);

  const runTrackedWorkItemUpdate = React.useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      workItemSyncInFlightRef.current += 1;
      setWorkItemSyncState("syncing");
      setWorkItemSyncError(null);

      try {
        return await operation();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Write failed.";
        setWorkItemSyncState("error");
        setWorkItemSyncError(message);
        throw error;
      } finally {
        workItemSyncInFlightRef.current = Math.max(0, workItemSyncInFlightRef.current - 1);
        if (workItemSyncInFlightRef.current === 0) {
          setWorkItemSyncState((current) => (current === "error" ? current : "up_to_date"));
        }
      }
    },
    []
  );

  const fetchWorkItemStateOptions = fetchWorkItemStateOptionsCached;

  React.useEffect(() => {
    persistUiShellState({
      activeTab,
      response,
      lastRunRequest
    });
  }, [activeTab, lastRunRequest, response]);

  React.useEffect(() => {
    persistThemeMode(themeMode);
    applyThemeMode(themeMode);

    if (themeMode !== "system" || typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      applyThemeMode("system");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
      return () => {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      };
    }

    mediaQuery.addListener(handleSystemThemeChange);
    return () => {
      mediaQuery.removeListener(handleSystemThemeChange);
    };
  }, [themeMode]);

  const mainPanel = renderActivePanel({
    activeTab,
    uiModel,
    response,
    mappingFixResponse,
    onRun: runQuery,
    onNeedsFix: handleNeedsFix,
    onAuthenticateAzureCli: props.composition.controller.authenticateAzureCli,
    onSetAzureCliPath: props.composition.controller.setAzureCliPath,
    onApplyMappingDefaults: applyMappingDefaults,
    onRetryRefresh: retryRefresh,
    adoCommLogs,
    adoCommLogsLoading,
    adoCommLogsError
  });

  return React.createElement(
    "main",
    { "data-ui-shell": "phase-6-runtime", className: "ui-shell" },
    React.createElement(
      "section",
      { className: "ui-shell-header" },
      React.createElement(
        "div",
        { className: "ui-shell-brand" },
        React.createElement("h1", null, "Azure GanttOps")
      ),
      React.createElement(
        "div",
        { className: "ui-shell-header-actions" },
        React.createElement(
          "div",
          { className: "theme-menu" },
          React.createElement("button", {
            type: "button",
            className: "theme-menu-trigger",
            "aria-label": `Theme wechseln (aktuell: ${labelForThemeMode(themeMode)})`,
            title: `Theme: ${labelForThemeMode(themeMode)} (klicken zum Wechseln)`,
            onClick: () => {
              setThemeMode(nextThemeMode(themeMode));
            }
          }, React.createElement("span", { "aria-hidden": "true" }, iconForThemeMode(themeMode)))
        ),
        React.createElement(TrustBadge, {
          statusCode: uiModel.statusCode,
          trustState: uiModel.trustState,
          lastRefreshAt: uiModel.freshness.lastRefreshAt,
          readOnlyTimeline: uiModel.capabilities.readOnlyTimeline
        }),
        React.createElement(
          "button",
          {
            type: "button",
            className: "controls-toggle-button",
            "aria-expanded": controlsOpen,
            "aria-controls": "ui-controls-drawer",
            onClick: () => {
              setControlsOpen((current) => !current);
            }
          },
          controlsOpen ? "Close controls" : "Open controls"
        )
      )
    ),
    React.createElement(
      "section",
      { className: "ui-shell-content" },
      React.createElement(
        "section",
        { className: "gantt-primary-card" },
        React.createElement(WarningBanner, {
        uiState: uiModel.uiState,
        guidance: uiModel.guidance,
        retryActionLabel: uiModel.strictFail.retryActionLabel ?? "Refresh",
        hasStrictFailFallback: uiModel.strictFail.active,
        onRetryRefresh: () => {
          void retryRefresh();
          }
        }),
        React.createElement(TimelinePane, {
          timeline: uiModel.timeline,
          showDependencies: true,
          isRefreshing,
          workItemSyncState,
          workItemSyncError,
          organization,
          project,
          selectionStore: timelineSelectionStoreRef.current,
          onUpdateWorkItemSchedule: async ({ targetWorkItemId, startDate, endDate }) => {
            await runTrackedWorkItemUpdate(async () => {
              const writeResult = await props.composition.controller.adoptWorkItemSchedule({
                targetWorkItemId,
                startDate,
                endDate
              });

              if (!writeResult.accepted) {
                throw new Error(writeResult.reasonCode === "WRITE_DISABLED" ? "Writeback is disabled." : "Write failed.");
              }

              setUiModel((current) => ({
                ...current,
                timeline: applyScheduleUpdate(current.timeline, targetWorkItemId, startDate, endDate)
              }));
              setResponse((current) =>
                current
                  ? {
                      ...current,
                      timeline: applyScheduleUpdate(current.timeline, targetWorkItemId, startDate, endDate)
                    }
                  : current
              );
            });
          },
          onAdoptUnschedulableSchedule: async ({ targetWorkItemId, startDate, endDate }) => {
            await runTrackedWorkItemUpdate(async () => {
              const writeResult = await props.composition.controller.adoptWorkItemSchedule({
                targetWorkItemId,
                startDate,
                endDate
              });

              if (!writeResult.accepted) {
                throw new Error(writeResult.reasonCode === "WRITE_DISABLED" ? "Writeback is disabled." : "Write failed.");
              }

              setUiModel((current) => ({
                ...current,
                timeline: applyScheduleUpdate(current.timeline, targetWorkItemId, startDate, endDate)
              }));
              setResponse((current) =>
                current
                  ? {
                      ...current,
                      timeline: applyScheduleUpdate(current.timeline, targetWorkItemId, startDate, endDate)
                    }
                  : current
              );
            });
          },
          onUpdateSelectedWorkItemDetails: async ({ targetWorkItemId, title, descriptionHtml, state, stateColor }) => {
            await runTrackedWorkItemUpdate(async () => {
              const writeResult = await props.composition.controller.updateWorkItemDetails({
                targetWorkItemId,
                title,
                descriptionHtml,
                state
              });

              if (!writeResult.accepted) {
                throw new Error(writeResult.reasonCode === "WRITE_DISABLED" ? "Writeback is disabled." : "Write failed.");
              }

              setUiModel((current) => ({
                ...current,
                timeline: applyWorkItemMetadataUpdate(current.timeline, targetWorkItemId, title, descriptionHtml, state, stateColor)
              }));
              setResponse((current) =>
                current
                  ? {
                      ...current,
                      timeline: applyWorkItemMetadataUpdate(current.timeline, targetWorkItemId, title, descriptionHtml, state, stateColor)
                    }
                  : current
              );
            });
          },
          onFetchWorkItemStateOptions: fetchWorkItemStateOptions,
          onRetryRefresh: () => {
            void retryRefresh();
          }
        })
      ),
      React.createElement(
        "section",
        {
          id: "ui-controls-drawer",
          className: controlsOpen ? "ui-shell-workspace ui-shell-workspace-open" : "ui-shell-workspace",
          "aria-hidden": controlsOpen ? "false" : "true"
        },
        React.createElement(
          "p",
          { className: "ui-shell-side-title" },
          "Controls"
        ),
        React.createElement(TopTabs, {
          activeTab,
          model: uiModel,
          onTabChange: (tab) => {
            setActiveTab(tab);
          },
          onBlockedAttempt: (payload) => {
            setBlockerMessage(payload);
          }
        }),
        blockerMessage
          ? React.createElement(
              "section",
              {
                "aria-label": "tab-blocker-guidance",
                className: "tab-blocker-guidance"
              },
              React.createElement("strong", null, `Blocked ${blockerMessage.tab}`),
              React.createElement("div", null, `Reason: ${blockerMessage.reason}`),
              React.createElement("div", null, `Next action: ${blockerMessage.nextAction}`)
            )
          : null,
        mainPanel
      )
    )
  );
}

function resolvePersistedRefreshQueryInput(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const queryInput = localStorage.getItem(QUERY_INPUT_KEY) ?? "";
  const organization = localStorage.getItem(ORG_KEY) ?? "";
  const project = localStorage.getItem(PROJECT_KEY) ?? "";

  return resolveQueryRunInput(queryInput, organization, project);
}

type PersistedUiShellState = {
  activeTab: TabId;
  response: QueryIntakeResponse | null;
  lastRunRequest: RunRequest | null;
};

function readPersistedUiShellState(): PersistedUiShellState | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(UI_SHELL_STATE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedUiShellState;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const activeTab = parsed.activeTab;
    if (activeTab !== "query" && activeTab !== "mapping" && activeTab !== "timeline" && activeTab !== "diagnostics") {
      return null;
    }

    return {
      activeTab,
      response: parsed.response ?? null,
      lastRunRequest: parsed.lastRunRequest ?? null
    };
  } catch {
    return null;
  }
}

function persistUiShellState(state: PersistedUiShellState): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(UI_SHELL_STATE_KEY, JSON.stringify(state));
}

function resolveEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "dark") {
    return "dark";
  }

  if (mode === "light") {
    return "light";
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = resolveEffectiveTheme(mode);
}

function readPersistedThemeMode(): ThemeMode {
  if (typeof localStorage === "undefined") {
    return "system";
  }

  const mode = localStorage.getItem(THEME_MODE_KEY);
  if (mode === "system" || mode === "dark" || mode === "light") {
    return mode;
  }

  return "system";
}

function persistThemeMode(mode: ThemeMode): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(THEME_MODE_KEY, mode);
}

function iconForThemeMode(mode: ThemeMode): string {
  if (mode === "dark") {
    return "☾";
  }

  if (mode === "light") {
    return "☼";
  }

  return "◩";
}

function labelForThemeMode(mode: ThemeMode): string {
  if (mode === "dark") {
    return "Dark";
  }

  if (mode === "light") {
    return "Light";
  }

  return "System";
}

function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === "system") {
    return "dark";
  }

  if (mode === "dark") {
    return "light";
  }

  return "system";
}

function renderActivePanel(params: {
  activeTab: TabId;
  uiModel: QueryIntakeUiModel;
  response: QueryIntakeResponse | null;
  mappingFixResponse: QueryIntakeResponse | null;
  onRun: (request: {
    queryId: string;
    mappingProfileId?: string;
    mappingProfileUpsert?: {
      id: string;
      name: string;
      fields: {
        id: string;
        title: string;
        start: string;
        endOrTarget: string;
      };
    };
  }) => Promise<QueryIntakeResponse>;
  onNeedsFix: (response: QueryIntakeResponse) => void;
  onAuthenticateAzureCli: () => Promise<{
    status: "OK";
    message: string;
  }>;
  onSetAzureCliPath: (path: string) => Promise<{
    status: "OK";
    path: string;
  }>;
  onApplyMappingDefaults: (selection: {
    id: string;
    title: string;
    start: string;
    endOrTarget: string;
  }) => Promise<void>;
  onRetryRefresh: () => Promise<void>;
  adoCommLogs: AdoCommLogEntry[];
  adoCommLogsLoading: boolean;
  adoCommLogsError: string | null;
}): React.ReactElement {
  if (params.activeTab === "query") {
    const savedQueries = params.response?.savedQueries ?? [];
    return React.createElement(
      "section",
      { role: "tabpanel", id: "tabpanel-query", "aria-labelledby": "tab-query" },
      React.createElement(QuerySelector, {
        savedQueries: savedQueries.map((query) => ({ id: query.id, name: query.name })),
        availableFieldRefs: [
          "System.Id",
          "System.Title",
          "Microsoft.VSTS.Scheduling.StartDate",
          "Microsoft.VSTS.Scheduling.TargetDate"
        ],
        onRun: params.onRun,
        onNeedsFix: params.onNeedsFix,
        authStatus: params.response?.preflightStatus ?? null,
        onAuthenticateAzureCli: params.onAuthenticateAzureCli,
        onSetAzureCliPath: params.onSetAzureCliPath
      })
    );
  }

  if (params.activeTab === "mapping") {
    return React.createElement(
      "section",
      { role: "tabpanel", id: "tabpanel-mapping", "aria-labelledby": "tab-mapping" },
      params.mappingFixResponse && params.mappingFixResponse.mappingValidation.status === "invalid"
        ? React.createElement(MappingFixPanel, {
            requiredIssues: params.mappingFixResponse.mappingValidation.issues,
            onApply: (selection) => {
              void params.onApplyMappingDefaults(selection);
            }
          })
        : React.createElement("div", null, "Mapping is valid. No remediation needed.")
    );
  }

  if (params.activeTab === "timeline") {
    return React.createElement(
      "section",
      { role: "tabpanel", id: "tabpanel-timeline", "aria-labelledby": "tab-timeline" },
      React.createElement(
        "p",
        { className: "timeline-focus-note" },
        "Gantt-Fokus ist aktiv. Nutze Query und Mapping Tabs nur, um Datenquelle und Feldzuordnung anzupassen."
      )
    );
  }

  const diagnostics = buildDiagnosticsModel(params.uiModel);
  return React.createElement(
    "section",
    { role: "tabpanel", id: "tabpanel-diagnostics", "aria-labelledby": "tab-diagnostics" },
    React.createElement(DiagnosticsTab, {
      ...diagnostics,
      onRetryRefresh: () => {
        void params.onRetryRefresh();
      }
    }),
    renderAdoCommLogPanel({
      logs: params.adoCommLogs,
      loading: params.adoCommLogsLoading,
      error: params.adoCommLogsError
    })
  );
}

function createInitialUiModel(): QueryIntakeUiModel {
  return {
    uiState: "empty",
    trustState: "needs_attention",
    statusCode: "UNKNOWN_ERROR",
    errorCode: null,
    guidance: "Select a saved query to load timeline data.",
    freshness: {
      activeQueryId: null,
      lastRefreshAt: null,
      reloadSource: null
    },
    capabilities: {
      canRefresh: false,
      canSwitchQuery: false,
      canChangeDensity: true,
      canOpenDetails: true,
      readOnlyTimeline: true
    },
    strictFail: {
      active: false,
      message: null,
      retryActionLabel: null,
      dismissible: true,
      dismissed: false,
      lastSuccessfulRefreshAt: null,
      lastSuccessfulSource: null
    },
    mapping: {
      status: "invalid",
      issues: [],
      activeProfileId: null
    },
    timeline: null,
    tabs: [
      { id: "query", label: "Query", badge: "ok" },
      { id: "mapping", label: "Mapping", badge: "blocked" },
      { id: "timeline", label: "Timeline", badge: "blocked" },
      { id: "diagnostics", label: "Diagnostics", badge: "blocked" }
    ]
  };
}

function buildDiagnosticsModel(uiModel: QueryIntakeUiModel): {
  statusCode: string;
  errorCode: string | null;
  guidance: string | null;
  sourceHealth:
    | "HEALTHY"
    | "AUTH_EXPIRED_REAUTH_TRIGGERED"
    | "AUTH_WARNING"
    | "REFRESH_FAILED_LKG_ACTIVE"
    | "REFRESH_FAILED_NO_LKG";
  activeQueryId: string | null;
  lastRefreshAt: string | null;
  reloadSource: "full_reload" | "preflight_blocked" | "stale_discarded" | null;
} {
  return {
    statusCode: uiModel.statusCode,
    errorCode: uiModel.errorCode,
    guidance: uiModel.guidance,
    sourceHealth:
      uiModel.uiState === "auth_failure"
        ? "AUTH_EXPIRED_REAUTH_TRIGGERED"
        : uiModel.uiState === "ready_with_lkg_warning"
          ? "REFRESH_FAILED_LKG_ACTIVE"
          : uiModel.uiState === "partial_failure"
            ? "REFRESH_FAILED_NO_LKG"
            : uiModel.errorCode
              ? "AUTH_WARNING"
              : "HEALTHY",
    activeQueryId: uiModel.freshness.activeQueryId,
    lastRefreshAt: uiModel.freshness.lastRefreshAt,
    reloadSource: uiModel.freshness.reloadSource
  };
}
