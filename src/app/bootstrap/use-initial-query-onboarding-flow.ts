import React from "react";

import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import {
  resolveRuntimeQueryInput,
  type RuntimeQueryInputResolution
} from "../../features/query-switching/runtime-query-input.js";
import {
  hydrateUserPreferences,
  type UserPreferences
} from "../../shared/user-preferences/user-preferences.client.js";
import {
  resolveInitialQueryOnboardingStatus,
  type InitialQueryOnboardingStatus
} from "./ui-client-initial-query-onboarding.js";
import type { HeaderQuerySaveResult } from "./ui-client-header-query-flow.js";

const MISSING_QUERY_CONTEXT_ERROR_MESSAGE = "Add organization and project in settings.";
const INITIAL_QUERY_URL_ERROR_MESSAGE = "Füge eine vollständige Azure DevOps Query-URL ein.";

type UseInitialQueryOnboardingFlowParams = {
  restoredResponse: QueryIntakeResponse | null;
  runQuery: (request: { queryId: string }) => Promise<QueryIntakeResponse>;
  saveLoadedHeaderQuery: (input: RuntimeQueryInputResolution & {
    loadedResponse: QueryIntakeResponse;
  }) => Promise<HeaderQuerySaveResult>;
  hydratePreferences?: () => Promise<UserPreferences>;
};

export type InitialQueryOnboardingFlowApi = {
  status: InitialQueryOnboardingStatus;
  hydratedPreferences: UserPreferences | null;
  queryInput: string;
  loading: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  setQueryInput: (value: string) => void;
  submit: () => Promise<void>;
  completeInitialQueryOnboarding: () => void;
};

function getInitialQueryOnboardingErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === MISSING_QUERY_CONTEXT_ERROR_MESSAGE) {
    return INITIAL_QUERY_URL_ERROR_MESSAGE;
  }

  return error instanceof Error ? error.message : "Query konnte nicht geladen werden.";
}

export function useInitialQueryOnboardingFlow(
  params: UseInitialQueryOnboardingFlowParams
): InitialQueryOnboardingFlowApi {
  const hydratePreferences = params.hydratePreferences ?? hydrateUserPreferences;
  const [status, setStatus] = React.useState<InitialQueryOnboardingStatus>("pending_hydration");
  const [hydratedPreferences, setHydratedPreferences] = React.useState<UserPreferences | null>(null);
  const [queryInput, setQueryInputState] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const latestSignalsRef = React.useRef({
    restoredResponse: params.restoredResponse
  });

  latestSignalsRef.current = {
    restoredResponse: params.restoredResponse
  };

  React.useEffect(() => {
    let cancelled = false;

    void hydratePreferences().then((preferences) => {
      if (cancelled) {
        return;
      }

      setHydratedPreferences(preferences);
      setStatus(
        resolveInitialQueryOnboardingStatus({
          hydrationState: "hydrated",
          preferences,
          ...latestSignalsRef.current
        })
      );
    });

    return () => {
      cancelled = true;
    };
  }, [hydratePreferences]);

  React.useEffect(() => {
    if (!hydratedPreferences || status !== "required") {
      return;
    }

    const nextStatus = resolveInitialQueryOnboardingStatus({
      hydrationState: "hydrated",
      preferences: hydratedPreferences,
      restoredResponse: params.restoredResponse
    });

    if (nextStatus !== status) {
      setStatus(nextStatus);
    }
  }, [hydratedPreferences, params.restoredResponse, status]);

  const completeInitialQueryOnboarding = React.useCallback(() => {
    setStatus("completed");
  }, []);

  const setQueryInput = React.useCallback((value: string) => {
    setQueryInputState(value);
    setErrorMessage(null);
  }, []);

  const submit = React.useCallback(async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Query wird geprüft...");

    try {
      const resolvedInput = resolveRuntimeQueryInput(queryInput);

      setStatusMessage("Query wird geladen...");
      const loadedResponse = await params.runQuery({
        queryId: resolvedInput.transportQueryInput
      });

      setStatusMessage("Query wird gespeichert...");
      const saveResult = await params.saveLoadedHeaderQuery({
        ...resolvedInput,
        loadedResponse
      });

      if (saveResult.kind === "saved") {
        completeInitialQueryOnboarding();
        setErrorMessage(null);
        setStatusMessage(null);
        return;
      }

      setErrorMessage(
        saveResult.kind === "error"
          ? saveResult.message
          : "Eine Query wird bereits geladen. Bitte warte kurz und versuche es erneut."
      );
      setStatusMessage(null);
    } catch (error) {
      setErrorMessage(getInitialQueryOnboardingErrorMessage(error));
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  }, [
    completeInitialQueryOnboarding,
    loading,
    params,
    queryInput
  ]);

  return {
    status,
    hydratedPreferences,
    queryInput,
    loading,
    statusMessage,
    errorMessage,
    setQueryInput,
    submit,
    completeInitialQueryOnboarding
  };
}
