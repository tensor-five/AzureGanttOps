import React from "react";

import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { SavedQueryPreference } from "../../shared/user-preferences/user-preferences.client.js";
import {
  createInitialHeaderQueryFlowState,
  deleteSavedHeaderQueryFlow,
  loadSavedHeaderQueryFlow,
  resolveFilteredHeaderQueries,
  saveCurrentHeaderQueryFlow,
  saveLoadedHeaderQueryFlow,
  type HeaderQuerySaveResult,
  type HeaderQueryFlowState
} from "./ui-client-header-query-flow.js";
import type { RuntimeQueryInputResolution } from "../../features/query-switching/runtime-query-input.js";

type UseHeaderQueryFlowParams = {
  initialSavedHeaderQueries: SavedQueryPreference[];
  initialSelectedHeaderQueryId: string;
  runQuery: (request: { queryId: string }) => Promise<QueryIntakeResponse>;
  fetchQueryDetails: (input: { queryId: string }) => Promise<{ name: string }>;
  getResponse: () => QueryIntakeResponse | null;
  headerSavedQueryLimit: number;
};

export type HeaderQueryFlowApi = HeaderQueryFlowState & {
  setNewHeaderQueryInput: React.Dispatch<React.SetStateAction<string>>;
  setHeaderQuerySearch: React.Dispatch<React.SetStateAction<string>>;
  setHeaderQueryMessage: React.Dispatch<React.SetStateAction<string | null>>;
  filteredHeaderQueries: SavedQueryPreference[];
  toggleNewHeaderQueryMode: () => void;
  loadSavedHeaderQuery: (queryId: string) => Promise<void>;
  saveCurrentHeaderQuery: (rawInput: string) => Promise<void>;
  saveLoadedHeaderQuery: (input: RuntimeQueryInputResolution & {
    loadedResponse: QueryIntakeResponse;
  }) => Promise<HeaderQuerySaveResult>;
  deleteSavedHeaderQuery: (queryId: string) => void;
  hydrateSavedHeaderQueries: (savedHeaderQueries: SavedQueryPreference[], selectedHeaderQueryId: string) => void;
};

export function useHeaderQueryFlow(params: UseHeaderQueryFlowParams): HeaderQueryFlowApi {
  const initialState = React.useMemo(
    () =>
      createInitialHeaderQueryFlowState({
        savedQueries: params.initialSavedHeaderQueries,
        selectedHeaderQueryId: params.initialSelectedHeaderQueryId
      }),
    [params.initialSavedHeaderQueries, params.initialSelectedHeaderQueryId]
  );

  const [savedHeaderQueries, setSavedHeaderQueries] = React.useState(initialState.savedHeaderQueries);
  const [selectedHeaderQueryId, setSelectedHeaderQueryId] = React.useState(initialState.selectedHeaderQueryId);
  const [newHeaderQueryMode, setNewHeaderQueryMode] = React.useState(initialState.newHeaderQueryMode);
  const [newHeaderQueryInput, setNewHeaderQueryInput] = React.useState(initialState.newHeaderQueryInput);
  const [headerQuerySearch, setHeaderQuerySearch] = React.useState(initialState.headerQuerySearch);
  const [headerQueryLoading, setHeaderQueryLoading] = React.useState(initialState.headerQueryLoading);
  const [headerQueryMessage, setHeaderQueryMessage] = React.useState(initialState.headerQueryMessage);

  const filteredHeaderQueries = React.useMemo(() => {
    return resolveFilteredHeaderQueries(savedHeaderQueries, headerQuerySearch);
  }, [headerQuerySearch, savedHeaderQueries]);

  const toggleNewHeaderQueryMode = React.useCallback(() => {
    setNewHeaderQueryMode((current) => !current);
    setHeaderQueryMessage(null);
  }, []);

  const loadSavedHeaderQuery = React.useCallback(
    async (queryId: string) => {
      if (headerQueryLoading) {
        return;
      }
      setHeaderQueryLoading(true);
      try {
        const result = await loadSavedHeaderQueryFlow({
          queryId,
          state: {
            savedHeaderQueries,
            headerQueryLoading
          },
          runQuery: params.runQuery
        });

        if (result.kind === "loaded") {
          setSelectedHeaderQueryId(result.selectedHeaderQueryId);
          setHeaderQueryMessage(null);
        }

        if (result.kind === "error") {
          setHeaderQueryMessage(result.message);
        }
      } catch (error) {
        setHeaderQueryMessage(resolveUnexpectedHeaderQueryErrorMessage(error));
      } finally {
        setHeaderQueryLoading(false);
      }
    },
    [headerQueryLoading, params.runQuery, savedHeaderQueries]
  );

  const saveCurrentHeaderQuery = React.useCallback(
    async (rawInput: string) => {
      if (headerQueryLoading) {
        return;
      }
      setHeaderQueryLoading(true);

      try {
        const result = await saveCurrentHeaderQueryFlow({
          rawInput,
          state: {
            savedHeaderQueries,
            headerQueryLoading
          },
          response: params.getResponse(),
          runQuery: params.runQuery,
          fetchQueryDetails: params.fetchQueryDetails,
          headerSavedQueryLimit: params.headerSavedQueryLimit
        });

        if (result.kind === "saved") {
          applySavedHeaderQueryResult(result, {
            setSavedHeaderQueries,
            setSelectedHeaderQueryId
          });
          setNewHeaderQueryMode(false);
          setNewHeaderQueryInput("");
          setHeaderQueryMessage(null);
        }

        if (result.kind === "error") {
          setHeaderQueryMessage(result.message);
        }
      } catch (error) {
        setHeaderQueryMessage(resolveUnexpectedHeaderQueryErrorMessage(error));
      } finally {
        setHeaderQueryLoading(false);
      }
    },
    [headerQueryLoading, params, savedHeaderQueries]
  );

  const saveLoadedHeaderQuery = React.useCallback(
    async (input: RuntimeQueryInputResolution & { loadedResponse: QueryIntakeResponse }): Promise<HeaderQuerySaveResult> => {
      if (headerQueryLoading) {
        return {
          kind: "ignored_loading"
        };
      }
      setHeaderQueryLoading(true);

      try {
        const result = await saveLoadedHeaderQueryFlow({
          ...input,
          state: {
            savedHeaderQueries,
            headerQueryLoading
          },
          fetchQueryDetails: params.fetchQueryDetails,
          headerSavedQueryLimit: params.headerSavedQueryLimit
        });

        if (result.kind === "saved") {
          applySavedHeaderQueryResult(result, {
            setSavedHeaderQueries,
            setSelectedHeaderQueryId
          });
          setNewHeaderQueryMode(false);
          setNewHeaderQueryInput("");
          setHeaderQueryMessage(null);
        }

        if (result.kind === "error") {
          setHeaderQueryMessage(result.message);
        }

        return result;
      } catch (error) {
        const result: HeaderQuerySaveResult = {
          kind: "error",
          message: resolveUnexpectedHeaderQueryErrorMessage(error)
        };
        setHeaderQueryMessage(result.message);
        return result;
      } finally {
        setHeaderQueryLoading(false);
      }
    },
    [headerQueryLoading, params.fetchQueryDetails, params.headerSavedQueryLimit, savedHeaderQueries]
  );

  const deleteSavedHeaderQuery = React.useCallback(
    (queryId: string) => {
      const result = deleteSavedHeaderQueryFlow({
        queryId,
        state: {
          savedHeaderQueries,
          selectedHeaderQueryId
        }
      });
      setSavedHeaderQueries(result.savedHeaderQueries);
      setSelectedHeaderQueryId(result.selectedHeaderQueryId);
      setHeaderQueryMessage(null);
    },
    [savedHeaderQueries, selectedHeaderQueryId]
  );

  const hydrateSavedHeaderQueries = React.useCallback((nextSavedHeaderQueries: SavedQueryPreference[], nextSelectedId: string) => {
    setSavedHeaderQueries(nextSavedHeaderQueries);
    setSelectedHeaderQueryId(nextSelectedId);
  }, []);

  return {
    savedHeaderQueries,
    selectedHeaderQueryId,
    newHeaderQueryMode,
    newHeaderQueryInput,
    headerQuerySearch,
    headerQueryLoading,
    headerQueryMessage,
    setNewHeaderQueryInput,
    setHeaderQuerySearch,
    setHeaderQueryMessage,
    filteredHeaderQueries,
    toggleNewHeaderQueryMode,
    loadSavedHeaderQuery,
    saveCurrentHeaderQuery,
    saveLoadedHeaderQuery,
    deleteSavedHeaderQuery,
    hydrateSavedHeaderQueries
  };
}

function applySavedHeaderQueryResult(
  result: Extract<HeaderQuerySaveResult, { kind: "saved" }>,
  setters: {
    setSavedHeaderQueries: React.Dispatch<React.SetStateAction<SavedQueryPreference[]>>;
    setSelectedHeaderQueryId: React.Dispatch<React.SetStateAction<string>>;
  }
): void {
  setters.setSavedHeaderQueries(result.savedHeaderQueries);
  setters.setSelectedHeaderQueryId(result.selectedHeaderQueryId);
}

function resolveUnexpectedHeaderQueryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Query could not be loaded.";
}
