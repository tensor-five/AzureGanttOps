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
import { QuerySelector } from "../../features/query-switching/query-selector.js";
import { InitialQueryOnboardingDialog } from "../../features/query-switching/initial-query-onboarding-dialog.js";
import {
  ORG_KEY,
  PROJECT_KEY
} from "../../features/query-switching/runtime-query-input.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import { MappingFixPanel } from "../../features/field-mapping/mapping-fix-panel.js";
import { TimelinePane } from "../../features/gantt-view/timeline-pane.js";
import { createTimelineSelectionStore } from "../../features/gantt-view/selection-store.js";
import {
  hydrateTimelineLiveSyncEnabledPreference,
  loadTimelineLiveSyncEnabledPreference,
  saveTimelineLiveSyncEnabledPreference
} from "../../features/gantt-view/timeline-live-sync-preference.js";
import { WarningBanner } from "../../features/diagnostics/warning-banner.js";
import { TrustBadge } from "../../features/diagnostics/trust-badge.js";
import { LocalConfigResetPanel } from "../../features/diagnostics/local-config-reset-panel.js";
import { evaluateLocalConfigResetGuard } from "../../features/diagnostics/local-config-reset-guard.js";
import { DiagnosticsTab } from "../../features/diagnostics/diagnostics-tab.js";
import { mapQueryIntakeResponseToUiModel, type QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";
import { enrichResponseWithRuntimeStateColors } from "../../shared/ui-state/timeline-runtime-state-colors.js";
import { deriveActiveTabForQueryResponse, shouldOpenMappingFixTab } from "../../shared/ui-state/query-intake-flow-state.js";
import { getCachedUserPreferences, persistUserPreferencesPatch } from "../../shared/user-preferences/user-preferences.client.js";
import {
  applyCreatedChildWorkItemToResponse,
  applyDependencyLinkUpdate,
  applyDuplicateWorkItemToResponse,
  applyReparentUpdate,
  applyScheduleUpdate,
  applyWorkItemMetadataUpdate,
  applyWorkItemStateUpdate
} from "./ui-client-timeline-mutations.js";
import {
  persistUiShellState,
  readPersistedUiShellState,
  toShortQueryName
} from "./ui-client-storage.js";
import {
  applyThemeMode,
  iconForEffectiveTheme,
  labelForThemeMode,
  nextThemeMode,
  persistThemeMode,
  readPersistedThemeMode,
  resolveEffectiveTheme,
  type EffectiveTheme,
  type ThemeMode
} from "./ui-client-theme.js";
import { useAdoCommLogPolling } from "./use-ado-comm-log-polling.js";
import { dismissOpenDetailsMenus, isTargetInsideElement } from "./ui-client-menu-dismiss.js";
import {
  buildSessionExpiredRefreshBlocker,
  runRetryRefreshFlow,
  type RunRequest
} from "./ui-client-refresh-flow.js";
import {
  createRefreshDiscardWarningInput,
  runWithInFlightGuard,
  shouldFlushLiveSyncBeforeRefresh,
  shouldShowRefreshDiscardWarning,
  type RefreshDiscardWarningInput,
  type RefreshDiscardWarningState
} from "./ui-client-refresh-guard.js";
import {
  applyTimelineMutationToUiState,
  runTrackedWorkItemSync,
  toWritebackError
} from "./ui-client-writeback-flow.js";
import {
  applyPendingWorkItemMutationsToResponse,
  createPendingWorkItemMutation,
  flushPendingWorkItemMutations,
  upsertPendingWorkItemMutation,
  type PendingWorkItemMutation
} from "./ui-client-work-item-sync.js";
import { resolveHydratedHeaderQuerySelection } from "./ui-client-header-query-flow.js";
import { resolveActiveQueryName } from "./ui-client-header-query-service.js";
import { buildAzureQueryUrl } from "../../shared/azure-devops/azure-query-url.js";
import { GITHUB_REPO_URL, TENSORFIVE_WEBSITE_URL } from "../../shared/project-meta/project-meta.js";
import { useHeaderQueryFlow } from "./use-header-query-flow.js";
import { useInitialQueryOnboardingFlow } from "./use-initial-query-onboarding-flow.js";
import type { WorkItemSyncState } from "../../shared/ui-state/work-item-sync-state.js";
import { clearBrowserLocalConfigs } from "./local-config-browser-cleanup.js";
import { AppReleaseBadge } from "./app-release-badge.js";
import { useAppUpdateCheck } from "./use-app-update-check.js";

const ADO_COMM_LOG_POLL_INTERVAL_MS = 3000;
const ADO_COMM_LOG_READ_LIMIT = 200;
const ADO_COMM_LOG_UI_MAX = 1000;
const UI_SHELL_STATE_KEY = "azure-ganttops.ui-shell-state.v1";
const THEME_MODE_KEY = "azure-ganttops.theme-mode.v1";
const HEADER_SAVED_QUERY_LIMIT = 25;

type HeaderDialogMode = "changelog" | "update_notice" | "keyboard_shortcuts";

const LazyAppChangelogDialog = React.lazy(async () => {
  const module = await import("./app-changelog-dialog.js");
  return { default: module.AppChangelogDialog };
});

const LazyAppKeyboardShortcutsDialog = React.lazy(async () => {
  const module = await import("./app-keyboard-shortcuts-dialog.js");
  return { default: module.AppKeyboardShortcutsDialog };
});

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
      open: true,
      "data-auto-dismiss": "off"
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

export function UiShellApp(props: { composition: UiShellComposition }): React.ReactElement {
  const restoredState = React.useMemo(
    () => readPersistedUiShellState<QueryIntakeResponse, RunRequest>(UI_SHELL_STATE_KEY),
    []
  );
  const initialResponse = restoredState?.response ?? null;
  const initialLastRunRequest = restoredState?.lastRunRequest ?? null;
  const initialActiveTab: TabId =
    initialResponse && initialResponse.mappingValidation.status === "invalid"
      ? "mapping"
      : (restoredState?.activeTab ?? "query");
  const cachedPreferences = getCachedUserPreferences();

  const [activeTab, setActiveTab] = React.useState<TabId>(initialActiveTab);
  const [controlsOpen, setControlsOpen] = React.useState(false);
  const [headerDialogMode, setHeaderDialogMode] = React.useState<HeaderDialogMode | null>(null);
  const [response, setResponse] = React.useState<QueryIntakeResponse | null>(initialResponse);
  const [lastRunRequest, setLastRunRequest] = React.useState<RunRequest | null>(initialLastRunRequest);
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
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() =>
    readPersistedThemeMode(THEME_MODE_KEY, getCachedUserPreferences().themeMode)
  );
  const [effectiveTheme, setEffectiveTheme] = React.useState<EffectiveTheme>(() => resolveEffectiveTheme(themeMode));
  const [liveSyncEnabled, setLiveSyncEnabled] = React.useState<boolean>(() => loadTimelineLiveSyncEnabledPreference());
  const responseRef = React.useRef<QueryIntakeResponse | null>(initialResponse);
  const [workItemSyncState, setWorkItemSyncState] = React.useState<WorkItemSyncState>(() =>
    loadTimelineLiveSyncEnabledPreference() ? "up_to_date" : "paused"
  );
  const [pendingWorkItemSyncCount, setPendingWorkItemSyncCount] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [showRefreshDiscardWarning, setShowRefreshDiscardWarning] = React.useState(false);
  const [detailsPanelDirty, setDetailsPanelDirty] = React.useState(false);
  const [detailsDraftResetKey, setDetailsDraftResetKey] = React.useState(0);
  const [hasOptimisticChanges, setHasOptimisticChanges] = React.useState(false);
  const isRefreshingRef = React.useRef(isRefreshing);
  const workItemSyncInFlightRef = React.useRef(0);
  const pendingWorkItemMutationsRef = React.useRef<PendingWorkItemMutation[]>([]);
  const preOptimisticResponseSnapshotRef = React.useRef<QueryIntakeResponse | null>(null);
  const flushPendingWorkItemMutationsPromiseRef = React.useRef<Promise<void> | null>(null);
  const retryRefreshInFlightPromiseRef = React.useRef<Promise<void> | null>(null);
  const refreshGuardStateRef = React.useRef<RefreshDiscardWarningState>({
    detailsPanelDirty: false,
    hasOptimisticChanges: false,
    liveSyncEnabled,
    workItemSyncState
  });
  const liveSyncEnabledRef = React.useRef(liveSyncEnabled);
  const timelineSelectionStoreRef = React.useRef(createTimelineSelectionStore());
  const changelogVersionButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const keyboardShortcutsButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const changelogUpdateButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const workItemStateOptionsCacheRef = React.useRef<Map<number, Array<{ name: string; color: string | null }>>>(new Map());
  isRefreshingRef.current = isRefreshing;
  refreshGuardStateRef.current = {
    detailsPanelDirty,
    hasOptimisticChanges,
    liveSyncEnabled,
    workItemSyncState
  };
  const organization = readLocalStorageValue(ORG_KEY);
  const project = readLocalStorageValue(PROJECT_KEY);
  const changelogOpen = headerDialogMode === "changelog" || headerDialogMode === "update_notice";
  const keyboardShortcutsOpen = headerDialogMode === "keyboard_shortcuts";
  const changelogReturnFocusRef =
    headerDialogMode === "update_notice" ? changelogUpdateButtonRef : changelogVersionButtonRef;
  const { updateNotice, trigger: triggerAppUpdateCheck } = useAppUpdateCheck({
    checkAppUpdate: props.composition.controller.checkAppUpdate
  });
  const adoCommLogPolling = useAdoCommLogPolling({
    controller: props.composition.controller,
    pollIntervalMs: ADO_COMM_LOG_POLL_INTERVAL_MS,
    readLimit: ADO_COMM_LOG_READ_LIMIT,
    maxEntries: ADO_COMM_LOG_UI_MAX
  });

  const updateRefreshGuardState = React.useCallback((patch: Partial<RefreshDiscardWarningState>) => {
    refreshGuardStateRef.current = {
      ...refreshGuardStateRef.current,
      ...patch
    };
  }, []);

  const setGuardedHasOptimisticChanges = React.useCallback(
    (next: boolean) => {
      updateRefreshGuardState({ hasOptimisticChanges: next });
      setHasOptimisticChanges(next);
    },
    [updateRefreshGuardState]
  );

  const setGuardedWorkItemSyncState = React.useCallback(
    (next: React.SetStateAction<WorkItemSyncState>) => {
      const current = refreshGuardStateRef.current.workItemSyncState;
      const resolved = typeof next === "function" ? next(current) : next;
      updateRefreshGuardState({ workItemSyncState: resolved });
      setWorkItemSyncState(resolved);
    },
    [updateRefreshGuardState]
  );

  const setGuardedLiveSyncEnabled = React.useCallback(
    (enabled: boolean) => {
      liveSyncEnabledRef.current = enabled;
      updateRefreshGuardState({ liveSyncEnabled: enabled });
      setLiveSyncEnabled(enabled);
    },
    [updateRefreshGuardState]
  );

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

  const enrichRuntimeStateColors = React.useCallback(
    async (incoming: QueryIntakeResponse): Promise<QueryIntakeResponse> => {
      return enrichResponseWithRuntimeStateColors(incoming, fetchWorkItemStateOptionsCached);
    },
    [fetchWorkItemStateOptionsCached]
  );

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
      try {
        const result = await props.composition.runQuerySelectionFlow({
          queryId: request.queryId,
          mappingProfileId: request.mappingProfileId,
          mappingProfileUpsert: request.mappingProfileUpsert
        });
        const submitted = applyPendingWorkItemMutationsToResponse(
          await enrichRuntimeStateColors(result.response),
          pendingWorkItemMutationsRef.current
        );
        setResponse(submitted);
        setUiModel(mapQueryIntakeResponseToUiModel(submitted));
        setLastRunRequest({
          queryInput: request.queryId,
          mappingProfileId: request.mappingProfileId,
          mappingProfileUpsert: request.mappingProfileUpsert
        });
        setBlockerMessage(null);

        if (shouldOpenMappingFixTab(submitted)) {
          setMappingFixResponse(submitted);
          setActiveTab(deriveActiveTabForQueryResponse(submitted));
        } else {
          setMappingFixResponse(null);
          setActiveTab(deriveActiveTabForQueryResponse(submitted));
        }

        triggerAppUpdateCheck();
        return submitted;
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "An unexpected error occurred.";
        setBlockerMessage({
          tab: "query",
          reason,
          nextAction: "Check that Azure CLI is installed and authenticated, then retry."
        });
        setUiModel((prev) => ({
          ...prev,
          uiState: "auth_failure",
          trustState: "needs_attention",
          guidance: reason
        }));
        throw error;
      }
    },
    [enrichRuntimeStateColors, props.composition, triggerAppUpdateCheck]
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

  const readRefreshGuardInput = React.useCallback(
    (options?: { afterSuccessfulLiveSyncFlush?: boolean }): RefreshDiscardWarningInput =>
      createRefreshDiscardWarningInput({
        state: refreshGuardStateRef.current,
        pendingWorkItemMutationCount: pendingWorkItemMutationsRef.current.length,
        afterSuccessfulLiveSyncFlush: options?.afterSuccessfulLiveSyncFlush
      }),
    []
  );

  const handleDetailsDirtyChange = React.useCallback((dirty: boolean) => {
    updateRefreshGuardState({ detailsPanelDirty: dirty });
    setDetailsPanelDirty(dirty);
  }, [updateRefreshGuardState]);

  const handleSetLiveSyncEnabled = React.useCallback((enabled: boolean) => {
    setGuardedLiveSyncEnabled(enabled);
    saveTimelineLiveSyncEnabledPreference(enabled);
  }, [setGuardedLiveSyncEnabled]);

  const executeRefresh = React.useCallback(async (discardPendingChanges: boolean) => {
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    if (discardPendingChanges) {
      pendingWorkItemMutationsRef.current = [];
      setPendingWorkItemSyncCount(0);
      setGuardedHasOptimisticChanges(false);
    }

    try {
      const result = await runRetryRefreshFlow({
        lastRunRequest,
        submit: props.composition.controller.submit,
        enrichRuntimeStateColors,
        runQuery
      });

      if (result.kind === "blocked_no_query") {
        setActiveTab("query");
        setBlockerMessage(result.blocker);
        return;
      }

      if (result.kind === "refreshed") {
        const refreshedResponse = discardPendingChanges
          ? result.response
          : applyPendingWorkItemMutationsToResponse(
              result.response,
              pendingWorkItemMutationsRef.current
            );

        setResponse(refreshedResponse);
        setUiModel(mapQueryIntakeResponseToUiModel(refreshedResponse));
        if (result.openMappingFix) {
          setMappingFixResponse(result.response);
          setActiveTab(result.activeTab);
          setBlockerMessage(null);
        } else {
          setMappingFixResponse(null);
          setActiveTab(result.activeTab);
          setBlockerMessage(
            result.response.preflightStatus === "SESSION_EXPIRED"
              ? buildSessionExpiredRefreshBlocker()
              : null
          );
        }
        triggerAppUpdateCheck();
      }
      if (discardPendingChanges) {
        setDetailsDraftResetKey((current) => current + 1);
      }
      setGuardedHasOptimisticChanges(false);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [enrichRuntimeStateColors, lastRunRequest, props.composition.controller.submit, runQuery, setGuardedHasOptimisticChanges, triggerAppUpdateCheck]);

  const headerQueryFlow = useHeaderQueryFlow({
    initialSavedHeaderQueries: cachedPreferences.savedQueries ?? [],
    initialSelectedHeaderQueryId: cachedPreferences.selectedHeaderQueryId ?? "",
    runQuery: async ({ queryId }) => runQuery({ queryId }),
    fetchQueryDetails: props.composition.controller.fetchQueryDetails,
    getResponse: () => responseRef.current,
    headerSavedQueryLimit: HEADER_SAVED_QUERY_LIMIT
  });
  const initialQueryOnboardingFlow = useInitialQueryOnboardingFlow({
    restoredResponse: initialResponse,
    runQuery: async ({ queryId }) => runQuery({ queryId }),
    saveLoadedHeaderQuery: headerQueryFlow.saveLoadedHeaderQuery
  });

  const runTrackedWorkItemUpdate = React.useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      return runTrackedWorkItemSync({
        operation,
        inFlightRef: workItemSyncInFlightRef,
        setWorkItemSyncState: setGuardedWorkItemSyncState
      });
    },
    [setGuardedWorkItemSyncState]
  );

  const flushQueuedWorkItemMutations = React.useCallback(async (): Promise<void> => {
    if (flushPendingWorkItemMutationsPromiseRef.current) {
      return flushPendingWorkItemMutationsPromiseRef.current;
    }

    const flushPromise = flushPendingWorkItemMutations({
      queueRef: pendingWorkItemMutationsRef,
      onPendingCountChange: (count) => {
        setPendingWorkItemSyncCount(count);
        if (count === 0) {
          preOptimisticResponseSnapshotRef.current = null;
        }
      },
      runTrackedWorkItemSync: async (operation) => {
        await runTrackedWorkItemUpdate(operation);
      }
    })
      .then(() => {
        if (pendingWorkItemMutationsRef.current.length === 0) {
          setGuardedHasOptimisticChanges(false);
        }
        setGuardedWorkItemSyncState(liveSyncEnabledRef.current ? "up_to_date" : "paused");
      })
      .finally(() => {
        flushPendingWorkItemMutationsPromiseRef.current = null;
      });

    flushPendingWorkItemMutationsPromiseRef.current = flushPromise;
    return flushPromise;
  }, [runTrackedWorkItemUpdate, setGuardedHasOptimisticChanges, setGuardedWorkItemSyncState]);

  const runRetryRefresh = React.useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    const initialGuardInput = readRefreshGuardInput();

    let guardInput = initialGuardInput;

    if (shouldFlushLiveSyncBeforeRefresh(initialGuardInput)) {
      try {
        await flushQueuedWorkItemMutations();
      } catch {
        setShowRefreshDiscardWarning(true);
        return;
      }

      guardInput = readRefreshGuardInput({ afterSuccessfulLiveSyncFlush: true });
    }

    if (shouldShowRefreshDiscardWarning(guardInput)) {
      setShowRefreshDiscardWarning(true);
      return;
    }

    await executeRefresh(false);
  }, [executeRefresh, flushQueuedWorkItemMutations, readRefreshGuardInput]);

  const retryRefresh = React.useCallback(
    () => runWithInFlightGuard(retryRefreshInFlightPromiseRef, runRetryRefresh),
    [runRetryRefresh]
  );

  const enqueuePendingWorkItemMutation = React.useCallback((mutation: PendingWorkItemMutation) => {
    if (pendingWorkItemMutationsRef.current.length === 0) {
      preOptimisticResponseSnapshotRef.current = responseRef.current;
    }
    pendingWorkItemMutationsRef.current = upsertPendingWorkItemMutation(pendingWorkItemMutationsRef.current, mutation);
    setPendingWorkItemSyncCount(pendingWorkItemMutationsRef.current.length);
    setGuardedHasOptimisticChanges(true);
  }, [setGuardedHasOptimisticChanges]);

  const scheduleWorkItemMutation = React.useCallback(
    async (params: {
      workItemId: number;
      applyToTimeline: (timeline: QueryIntakeResponse["timeline"]) => QueryIntakeResponse["timeline"];
      executeSchedule?: () => Promise<void>;
      executeDetails?: () => Promise<void>;
    }): Promise<void> => {
      applyTimelineMutationToUiState(setUiModel, setResponse, params.applyToTimeline);
      enqueuePendingWorkItemMutation(
        createPendingWorkItemMutation({
          kind: "work_item",
          queryId: responseRef.current?.activeQueryId ?? null,
          workItemId: params.workItemId,
          applyToTimeline: params.applyToTimeline,
          executeSchedule: params.executeSchedule,
          executeDetails: params.executeDetails
        })
      );

      if (!liveSyncEnabledRef.current) {
        setGuardedWorkItemSyncState("paused");
        return;
      }

      await flushQueuedWorkItemMutations();
    },
    [enqueuePendingWorkItemMutation, flushQueuedWorkItemMutations, setGuardedWorkItemSyncState]
  );

  const scheduleDependencyMutation = React.useCallback(
    async (params: {
      predecessorWorkItemId: number;
      successorWorkItemId: number;
      dependencyAction: "add" | "remove";
      applyToTimeline: (timeline: QueryIntakeResponse["timeline"]) => QueryIntakeResponse["timeline"];
      execute: () => Promise<void>;
    }): Promise<void> => {
      applyTimelineMutationToUiState(setUiModel, setResponse, params.applyToTimeline);
      enqueuePendingWorkItemMutation(
        createPendingWorkItemMutation({
          kind: "dependency",
          queryId: responseRef.current?.activeQueryId ?? null,
          predecessorWorkItemId: params.predecessorWorkItemId,
          successorWorkItemId: params.successorWorkItemId,
          dependencyAction: params.dependencyAction,
          applyToTimeline: params.applyToTimeline,
          execute: params.execute
        })
      );

      if (!liveSyncEnabledRef.current) {
        setGuardedWorkItemSyncState("paused");
        return;
      }

      await flushQueuedWorkItemMutations();
    },
    [enqueuePendingWorkItemMutation, flushQueuedWorkItemMutations, setGuardedWorkItemSyncState]
  );

  const scheduleReparentMutation = React.useCallback(
    async (params: {
      targetWorkItemId: number;
      newParentId: number | null;
      applyToTimeline: (timeline: QueryIntakeResponse["timeline"]) => QueryIntakeResponse["timeline"];
      execute: () => Promise<void>;
    }): Promise<void> => {
      applyTimelineMutationToUiState(setUiModel, setResponse, params.applyToTimeline);
      enqueuePendingWorkItemMutation(
        createPendingWorkItemMutation({
          kind: "reparent",
          queryId: responseRef.current?.activeQueryId ?? null,
          targetWorkItemId: params.targetWorkItemId,
          newParentId: params.newParentId,
          applyToTimeline: params.applyToTimeline,
          execute: params.execute
        })
      );

      if (!liveSyncEnabledRef.current) {
        setGuardedWorkItemSyncState("paused");
        return;
      }

      await flushQueuedWorkItemMutations();
    },
    [enqueuePendingWorkItemMutation, flushQueuedWorkItemMutations, setGuardedWorkItemSyncState]
  );

  const fetchWorkItemStateOptions = fetchWorkItemStateOptionsCached;

  React.useEffect(() => {
    responseRef.current = response;
  }, [response]);

  React.useEffect(() => {
    liveSyncEnabledRef.current = liveSyncEnabled;
  }, [liveSyncEnabled]);

  React.useEffect(() => {
    persistUiShellState(UI_SHELL_STATE_KEY, {
      activeTab,
      response,
      lastRunRequest
    });
  }, [activeTab, lastRunRequest, response]);

  React.useEffect(() => {
    const preferences = initialQueryOnboardingFlow.hydratedPreferences;
    if (!preferences) {
      return;
    }

    if (preferences.themeMode) {
      setThemeMode(preferences.themeMode);
    }
    const hydratedHeaderQuerySelection = resolveHydratedHeaderQuerySelection(preferences);
    headerQueryFlow.hydrateSavedHeaderQueries(
      hydratedHeaderQuerySelection.savedHeaderQueries,
      hydratedHeaderQuerySelection.selectedHeaderQueryId
    );
  }, [headerQueryFlow.hydrateSavedHeaderQueries, initialQueryOnboardingFlow.hydratedPreferences]);

  React.useEffect(() => {
    hydrateTimelineLiveSyncEnabledPreference((enabled) => {
      setGuardedLiveSyncEnabled(enabled);
      setGuardedWorkItemSyncState((current) => (current === "syncing" ? current : enabled ? "up_to_date" : "paused"));
    });
  }, [setGuardedLiveSyncEnabled, setGuardedWorkItemSyncState]);

  React.useEffect(() => {
    if (liveSyncEnabled && pendingWorkItemMutationsRef.current.length > 0) {
      void flushQueuedWorkItemMutations();
      return;
    }

    if (workItemSyncInFlightRef.current > 0 || workItemSyncState === "error") {
      return;
    }

    setGuardedWorkItemSyncState(liveSyncEnabled ? "up_to_date" : "paused");
  }, [flushQueuedWorkItemMutations, liveSyncEnabled, pendingWorkItemSyncCount, setGuardedWorkItemSyncState, workItemSyncState]);

  React.useEffect(() => {
    const hasUnsavedChanges = () =>
      pendingWorkItemMutationsRef.current.length > 0 ||
      refreshGuardStateRef.current.detailsPanelDirty ||
      refreshGuardStateRef.current.hasOptimisticChanges;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  React.useEffect(() => {
    persistUserPreferencesPatch({
      themeMode
    });
    persistThemeMode(THEME_MODE_KEY, themeMode);
    const syncEffectiveTheme = () => {
      applyThemeMode(themeMode);
      setEffectiveTheme(resolveEffectiveTheme(themeMode));
    };

    syncEffectiveTheme();

    if (themeMode !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => syncEffectiveTheme();

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

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const trustBadgeElement = document.querySelector<HTMLDetailsElement>("details.trust-badge-details");

      if (controlsOpen && !isTargetInsideElement(target, trustBadgeElement)) {
        setControlsOpen(false);
      }

      dismissOpenDetailsMenus({
        root: document,
        target
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setControlsOpen(false);
      dismissOpenDetailsMenus({
        root: document,
        target: null
      });
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [controlsOpen]);

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
    adoCommLogs: adoCommLogPolling.logs,
    adoCommLogsLoading: adoCommLogPolling.loading,
    adoCommLogsError: adoCommLogPolling.error
  });
  const localConfigResetGuard = evaluateLocalConfigResetGuard({
    pendingWorkItemSyncCount,
    detailsPanelDirty,
    hasOptimisticChanges,
    isRefreshing,
    headerQueryLoading: headerQueryFlow.headerQueryLoading,
    workItemSyncState
  });
  const controlsContent = React.createElement(
    React.Fragment,
    null,
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
        setControlsOpen(true);
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
    React.createElement(LocalConfigResetPanel, {
      guard: localConfigResetGuard,
      onServerReset: props.composition.controller.resetLocalConfigs,
      onBrowserCleanup: () =>
        clearBrowserLocalConfigs({
          queryClient: props.composition.queryClient
        }),
      onReload: () => {
        window.location.reload();
      }
    }),
    mainPanel
  );

  return React.createElement(
    "main",
    { "data-ui-shell": "phase-6-runtime", className: "ui-shell" },
    React.createElement(
      "section",
      { className: "ui-shell-header" },
      React.createElement(
        "div",
        { className: "ui-shell-brand-row" },
        React.createElement(
          "div",
          { className: "ui-shell-brand" },
          React.createElement("h1", null, "AzureGanttOps")
        ),
        React.createElement(AppReleaseBadge, {
          open: changelogOpen,
          shortcutsOpen: keyboardShortcutsOpen,
          updateAvailable: updateNotice !== null,
          versionButtonRef: changelogVersionButtonRef,
          shortcutsButtonRef: keyboardShortcutsButtonRef,
          updateButtonRef: changelogUpdateButtonRef,
          onVersionClick: () => {
            setControlsOpen(false);
            setHeaderDialogMode("changelog");
          },
          onShortcutsClick: () => {
            setControlsOpen(false);
            setHeaderDialogMode("keyboard_shortcuts");
          },
          onUpdateClick: () => {
            setControlsOpen(false);
            setHeaderDialogMode("update_notice");
          }
        })
      ),
      React.createElement(
        "div",
        { className: "ui-shell-header-actions" },
        React.createElement(
          "div",
          { className: "header-query-picker" },
          React.createElement("label", { className: "header-query-picker-label" }, "Queries"),
          React.createElement(
            "details",
            { className: "header-query-dropdown" },
            React.createElement(
              "summary",
              { className: "header-query-dropdown-trigger" },
              headerQueryFlow.selectedHeaderQueryId
                ? toShortQueryName(
                    headerQueryFlow.savedHeaderQueries.find((entry) => entry.id === headerQueryFlow.selectedHeaderQueryId)?.name ??
                      headerQueryFlow.selectedHeaderQueryId,
                    headerQueryFlow.selectedHeaderQueryId
                  )
                : "Select query..."
            ),
            React.createElement(
              "div",
              { className: "header-query-dropdown-panel" },
              React.createElement("input", {
                className: "header-query-dropdown-search",
                "aria-label": "Search queries",
                placeholder: "Search...",
                value: headerQueryFlow.headerQuerySearch,
                onChange: (event) => {
                  headerQueryFlow.setHeaderQuerySearch((event.target as HTMLInputElement).value);
                }
              }),
              headerQueryFlow.savedHeaderQueries.length === 0
                ? React.createElement("div", { className: "header-query-dropdown-empty" }, "No saved queries")
                : React.createElement(
                    "div",
                    { className: "header-query-dropdown-list" },
                    ...(headerQueryFlow.filteredHeaderQueries.length === 0
                      ? [React.createElement("div", { key: "no-search-match", className: "header-query-dropdown-empty" }, "No matches")]
                      : headerQueryFlow.filteredHeaderQueries.map((entry) =>
                      React.createElement(
                        "div",
                        { key: `manage-${entry.id}`, className: "header-query-dropdown-item" },
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            className: "header-query-dropdown-item-delete",
                            "aria-label": `Delete query ${toShortQueryName(entry.name, entry.id)}`,
                            disabled: headerQueryFlow.headerQueryLoading,
                            onClick: (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              headerQueryFlow.deleteSavedHeaderQuery(entry.id);
                            }
                          },
                          "×"
                        ),
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            className: "header-query-dropdown-item-open",
                            "aria-label": `Open query ${toShortQueryName(entry.name, entry.id)} in Azure DevOps`,
                            title: "Open in Azure DevOps",
                            onClick: (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const entryOrg = entry.organization ?? organization;
                              const entryProject = entry.project ?? project;
                              const queryUrl = buildAzureQueryUrl(entryOrg, entryProject, entry.id);
                              if (queryUrl) {
                                window.open(queryUrl, "_blank", "noopener,noreferrer");
                              }
                            }
                          },
                          React.createElement(
                            "svg",
                            {
                              width: "14",
                              height: "14",
                              viewBox: "0 0 24 24",
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: "2",
                              strokeLinecap: "round",
                              strokeLinejoin: "round"
                            },
                            React.createElement("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
                            React.createElement("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" })
                          )
                        ),
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            className: "header-query-dropdown-item-select",
                            disabled: headerQueryFlow.headerQueryLoading,
                            onClick: () => {
                              void headerQueryFlow.loadSavedHeaderQuery(entry.id);
                            }
                          },
                          toShortQueryName(entry.name, entry.id)
                        )
                      )
                    ))
                  )
            )
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "header-query-picker-button",
              disabled: headerQueryFlow.headerQueryLoading,
              onClick: () => {
                headerQueryFlow.toggleNewHeaderQueryMode();
              }
            },
            "Add Query"
          ),
          headerQueryFlow.newHeaderQueryMode
            ? React.createElement("input", {
                className: "header-query-picker-input",
                "aria-label": "New query URL or ID",
                placeholder: "New query URL or ID",
                value: headerQueryFlow.newHeaderQueryInput,
                disabled: headerQueryFlow.headerQueryLoading,
                onChange: (event) => {
                  headerQueryFlow.setNewHeaderQueryInput((event.target as HTMLInputElement).value);
                  headerQueryFlow.setHeaderQueryMessage(null);
                },
                onKeyDown: (event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void headerQueryFlow.saveCurrentHeaderQuery(headerQueryFlow.newHeaderQueryInput);
                  }
                }
              })
            : null,
          headerQueryFlow.newHeaderQueryMode
            ? React.createElement(
                "button",
                {
                  type: "button",
                  className: "header-query-picker-button",
                  disabled: headerQueryFlow.headerQueryLoading,
                  onClick: () => {
                    void headerQueryFlow.saveCurrentHeaderQuery(headerQueryFlow.newHeaderQueryInput);
                  }
                },
                headerQueryFlow.headerQueryLoading ? "Loading..." : "Load"
              )
            : null,
          headerQueryFlow.headerQueryLoading
            ? React.createElement(
                "div",
                {
                  className: "header-query-loading",
                  role: "status",
                  "aria-live": "polite",
                  "aria-label": "Query is loading"
                },
                React.createElement("div", { className: "header-query-loading-bar" })
              )
            : null,
          headerQueryFlow.headerQueryMessage
            ? React.createElement(
                "span",
                {
                  className: "header-query-picker-message",
                  role: "status",
                  "aria-live": "polite"
                },
                headerQueryFlow.headerQueryMessage
              )
            : null
        ),
        React.createElement(
          "div",
          { className: "theme-menu" },
          React.createElement("button", {
            type: "button",
            className: "theme-menu-trigger",
            "aria-label": `Switch theme (current: ${labelForThemeMode(themeMode)})`,
            title: `Theme: ${labelForThemeMode(themeMode)} (click to switch)`,
            onClick: () => {
              setThemeMode(nextThemeMode(themeMode));
            }
          }, React.createElement("span", { "aria-hidden": "true" }, iconForEffectiveTheme(effectiveTheme)))
        ),
        React.createElement(TrustBadge, {
          statusCode: uiModel.statusCode,
          trustState: uiModel.trustState,
          lastRefreshAt: uiModel.freshness.lastRefreshAt,
          readOnlyTimeline: uiModel.capabilities.readOnlyTimeline,
          controlsOpen,
          onControlsOpenChange: setControlsOpen,
          controlsContent
        })
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
          key: response?.activeQueryId ?? "timeline-no-query",
          activeQueryId: response?.activeQueryId ?? null,
          activeQueryName: resolveActiveQueryName(
            response?.activeQueryId ?? null,
            response,
            headerQueryFlow.savedHeaderQueries
          ),
          timeline: uiModel.timeline,
          showDependencies: true,
          isRefreshing,
          workItemSyncState,
          liveSyncEnabled,
          pendingWorkItemSyncCount,
          organization,
          project,
          detailsDraftResetKey,
          selectionStore: timelineSelectionStoreRef.current,
          canCreateChildWorkItem: props.composition.capabilities.writeEnabled,
          onSetLiveSyncEnabled: handleSetLiveSyncEnabled,
          onPushPendingWorkItemChanges: () => {
            void flushQueuedWorkItemMutations();
          },
          onDetailsDirtyChange: handleDetailsDirtyChange,
          onClearPendingWorkItemChanges: () => {
            const snapshot = preOptimisticResponseSnapshotRef.current;
            pendingWorkItemMutationsRef.current = [];
            preOptimisticResponseSnapshotRef.current = null;
            setPendingWorkItemSyncCount(0);
            setGuardedHasOptimisticChanges(false);
            setGuardedWorkItemSyncState(liveSyncEnabledRef.current ? "up_to_date" : "paused");
            setDetailsDraftResetKey((current) => current + 1);
            if (snapshot) {
              setResponse(snapshot);
              setUiModel(mapQueryIntakeResponseToUiModel(snapshot));
            } else {
              void runWithInFlightGuard(retryRefreshInFlightPromiseRef, () => executeRefresh(true));
            }
          },
          onUpdateWorkItemSchedule: async ({ targetWorkItemId, startDate, endDate }) => {
            await scheduleWorkItemMutation({
              workItemId: targetWorkItemId,
              applyToTimeline: (timeline) => applyScheduleUpdate(timeline, targetWorkItemId, startDate, endDate),
              executeSchedule: async () => {
                const writeResult = await props.composition.controller.adoptWorkItemSchedule({
                  targetWorkItemId,
                  startDate,
                  endDate
                });

                if (!writeResult.accepted) {
                  throw toWritebackError(writeResult.reasonCode);
                }
              }
            });
          },
          onAdoptUnschedulableSchedule: async ({ targetWorkItemId, startDate, endDate }) => {
            await scheduleWorkItemMutation({
              workItemId: targetWorkItemId,
              applyToTimeline: (timeline) => applyScheduleUpdate(timeline, targetWorkItemId, startDate, endDate),
              executeSchedule: async () => {
                const writeResult = await props.composition.controller.adoptWorkItemSchedule({
                  targetWorkItemId,
                  startDate,
                  endDate
                });

                if (!writeResult.accepted) {
                  throw toWritebackError(writeResult.reasonCode);
                }
              }
            });
          },
          onCreateDependency: async ({ predecessorWorkItemId, successorWorkItemId }) => {
            await scheduleDependencyMutation({
              predecessorWorkItemId,
              successorWorkItemId,
              dependencyAction: "add",
              applyToTimeline: (timeline) =>
                applyDependencyLinkUpdate(timeline, predecessorWorkItemId, successorWorkItemId, "add"),
              execute: async () => {
                const writeResult = await props.composition.controller.linkDependency({
                  predecessorWorkItemId,
                  successorWorkItemId,
                  action: "add"
                });

                if (!writeResult.accepted) {
                  throw toWritebackError(writeResult.reasonCode);
                }
              }
            });
          },
          onRemoveDependency: async ({ predecessorWorkItemId, successorWorkItemId }) => {
            await scheduleDependencyMutation({
              predecessorWorkItemId,
              successorWorkItemId,
              dependencyAction: "remove",
              applyToTimeline: (timeline) =>
                applyDependencyLinkUpdate(timeline, predecessorWorkItemId, successorWorkItemId, "remove"),
              execute: async () => {
                const writeResult = await props.composition.controller.linkDependency({
                  predecessorWorkItemId,
                  successorWorkItemId,
                  action: "remove"
                });

                if (!writeResult.accepted) {
                  throw toWritebackError(writeResult.reasonCode);
                }
              }
            });
          },
          onUpdateSelectedWorkItemDetails: async ({ targetWorkItemId, title, descriptionHtml, state, stateColor }) => {
            await scheduleWorkItemMutation({
              workItemId: targetWorkItemId,
              applyToTimeline: (timeline) =>
                applyWorkItemMetadataUpdate(timeline, targetWorkItemId, title, descriptionHtml, state, stateColor),
              executeDetails: async () => {
                const writeResult = await props.composition.controller.updateWorkItemDetails({
                  targetWorkItemId,
                  title,
                  descriptionHtml,
                  state
                });

                if (!writeResult.accepted) {
                  throw toWritebackError(writeResult.reasonCode);
                }
              }
            });
          },
          onUpdateWorkItemState: async ({ targetWorkItemId, state, stateColor }) => {
            await scheduleWorkItemMutation({
              workItemId: targetWorkItemId,
              applyToTimeline: (timeline) =>
                applyWorkItemStateUpdate(timeline, targetWorkItemId, state, stateColor),
              executeDetails: async () => {
                const writeResult = await props.composition.controller.updateWorkItemState({
                  targetWorkItemId,
                  state
                });

                if (!writeResult.accepted) {
                  throw toWritebackError(writeResult.reasonCode);
                }
              }
            });
          },
          onDuplicateWorkItem: async ({ sourceWorkItemId, scheduleFieldRefs }) => {
            const writeResult = await runTrackedWorkItemUpdate(async () => {
              const writeResult = await props.composition.controller.duplicateWorkItem({
                sourceWorkItemId,
                ...(scheduleFieldRefs ? { scheduleFieldRefs } : {})
              });

              if (!writeResult.accepted) {
                throw toWritebackError(writeResult.reasonCode);
              }

              return writeResult;
            });

            const createdWorkItem = writeResult.createdWorkItem ??
              (writeResult.createdWorkItemId ? { id: writeResult.createdWorkItemId } : null);
            if (!createdWorkItem) {
              await retryRefresh();
              return;
            }

            const nextResponse = applyDuplicateWorkItemToResponse(responseRef.current, sourceWorkItemId, createdWorkItem);
            if (!nextResponse) {
              await retryRefresh();
              return;
            }

            if (nextResponse === responseRef.current) {
              return;
            }

            timelineSelectionStoreRef.current.select(createdWorkItem.id);
            responseRef.current = nextResponse;
            setResponse(nextResponse);
            setUiModel(mapQueryIntakeResponseToUiModel(nextResponse));
          },
          onCreateChildWorkItem: async ({ parentWorkItemId, childWorkItemType, title, scheduleFieldRefs }) => {
            const writeResult = await runTrackedWorkItemUpdate(async () => {
              const writeResult = await props.composition.controller.createChildWorkItem({
                parentWorkItemId,
                childWorkItemType,
                ...(title ? { title } : {}),
                ...(scheduleFieldRefs ? { scheduleFieldRefs } : {})
              });

              if (!writeResult.accepted) {
                throw toWritebackError(writeResult.reasonCode);
              }

              return writeResult;
            });

            const createdWorkItem = writeResult.createdWorkItem ??
              (writeResult.createdWorkItemId ? { id: writeResult.createdWorkItemId } : null);
            if (!createdWorkItem) {
              await retryRefresh();
              return;
            }

            const nextResponse = applyCreatedChildWorkItemToResponse(responseRef.current, parentWorkItemId, createdWorkItem);
            if (!nextResponse || nextResponse === responseRef.current) {
              await retryRefresh();
              return;
            }

            timelineSelectionStoreRef.current.select(createdWorkItem.id);
            responseRef.current = nextResponse;
            setResponse(nextResponse);
            setUiModel(mapQueryIntakeResponseToUiModel(nextResponse));
          },
          onFetchWorkItemTypes: async () => {
            const response = await props.composition.controller.fetchWorkItemTypes();
            return response.workItemTypes;
          },
          onReparentWorkItem: async ({ targetWorkItemId, newParentId }) => {
            await scheduleReparentMutation({
              targetWorkItemId,
              newParentId,
              applyToTimeline: (timeline) =>
                applyReparentUpdate(timeline, targetWorkItemId, newParentId),
              execute: async () => {
                const writeResult = await props.composition.controller.reparentWorkItem({
                  targetWorkItemId,
                  newParentId
                });

                if (!writeResult.accepted) {
                  throw toWritebackError(writeResult.reasonCode);
                }
              }
            });
          },
          onFetchWorkItemStateOptions: fetchWorkItemStateOptions,
          onRetryRefresh: () => {
            void retryRefresh();
          }
        })
      )
    ),
    React.createElement(
      "footer",
      { className: "ui-shell-footer" },
      React.createElement("span", null, "An "),
      React.createElement(
        "a",
        { href: GITHUB_REPO_URL, target: "_blank", rel: "noreferrer" },
        "Open Source Project"
      ),
      React.createElement("span", null, " by Christian Betz @ "),
      React.createElement(
        "a",
        { href: TENSORFIVE_WEBSITE_URL, target: "_blank", rel: "noreferrer" },
        "TensorFive GmbH"
      )
    ),
    changelogOpen
      ? React.createElement(
          React.Suspense,
          { fallback: null },
          React.createElement(LazyAppChangelogDialog, {
            open: true,
            onClose: () => setHeaderDialogMode(null),
            returnFocusRef: changelogReturnFocusRef,
            updateNotice: headerDialogMode === "update_notice" ? updateNotice : null
          })
        )
      : null,
    keyboardShortcutsOpen
      ? React.createElement(
          React.Suspense,
          { fallback: null },
          React.createElement(LazyAppKeyboardShortcutsDialog, {
            open: true,
            onClose: () => setHeaderDialogMode(null),
            returnFocusRef: keyboardShortcutsButtonRef
          })
        )
      : null,
    initialQueryOnboardingFlow.status === "required"
      ? React.createElement(InitialQueryOnboardingDialog, {
          queryInput: initialQueryOnboardingFlow.queryInput,
          loading: initialQueryOnboardingFlow.loading,
          statusMessage: initialQueryOnboardingFlow.statusMessage,
          errorMessage: initialQueryOnboardingFlow.errorMessage,
          onQueryInputChange: initialQueryOnboardingFlow.setQueryInput,
          onSubmit: initialQueryOnboardingFlow.submit
        })
      : null,
    showRefreshDiscardWarning
      ? React.createElement(
          "div",
          {
            className: "refresh-discard-warning-backdrop",
            onClick: () => setShowRefreshDiscardWarning(false)
          },
          React.createElement(
            "div",
            {
              className: "refresh-discard-warning-dialog",
              role: "alertdialog",
              "aria-labelledby": "refresh-discard-warning-title",
              "aria-describedby": "refresh-discard-warning-desc",
              onClick: (e: React.MouseEvent) => e.stopPropagation()
            },
            React.createElement(
              "h3",
              { id: "refresh-discard-warning-title", className: "refresh-discard-warning-title" },
              "Achtung: Ungespeicherte Änderungen"
            ),
            React.createElement(
              "p",
              { id: "refresh-discard-warning-desc", className: "refresh-discard-warning-desc" },
              "Es gibt ungespeicherte Änderungen, die beim Aktualisieren verloren gehen."
            ),
            React.createElement(
              "div",
              { className: "refresh-discard-warning-actions" },
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "refresh-discard-warning-cancel",
                  onClick: () => setShowRefreshDiscardWarning(false)
                },
                "Abbrechen"
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "refresh-discard-warning-confirm",
                  onClick: () => {
                    setShowRefreshDiscardWarning(false);
                    void runWithInFlightGuard(retryRefreshInFlightPromiseRef, () => executeRefresh(true));
                  }
                },
                "Verwerfen & Aktualisieren"
              )
            )
          )
        )
      : null
  );
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
            detectedFieldRefs: params.mappingFixResponse.detectedFieldRefs,
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
        "Gantt focus is active. Use Query and Mapping tabs only to adjust data source and field mapping."
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

function readLocalStorageValue(key: string): string {
  if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") {
    return "";
  }

  return localStorage.getItem(key) ?? "";
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
