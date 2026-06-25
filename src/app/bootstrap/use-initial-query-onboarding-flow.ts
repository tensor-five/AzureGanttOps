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

type UseInitialQueryOnboardingFlowParams = {
  restoredResponse: QueryIntakeResponse | null;
  initialOrganization: string;
  initialProject: string;
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
  organization: string;
  project: string;
  loading: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  setQueryInput: (value: string) => void;
  setOrganization: (value: string) => void;
  setProject: (value: string) => void;
  submit: () => Promise<void>;
  completeInitialQueryOnboarding: () => void;
};

export function useInitialQueryOnboardingFlow(
  params: UseInitialQueryOnboardingFlowParams
): InitialQueryOnboardingFlowApi {
  const hydratePreferences = params.hydratePreferences ?? hydrateUserPreferences;
  const [status, setStatus] = React.useState<InitialQueryOnboardingStatus>("pending_hydration");
  const [hydratedPreferences, setHydratedPreferences] = React.useState<UserPreferences | null>(null);
  const [queryInput, setQueryInputState] = React.useState("");
  const [organization, setOrganizationState] = React.useState(params.initialOrganization);
  const [project, setProjectState] = React.useState(params.initialProject);
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

  const setOrganization = React.useCallback((value: string) => {
    setOrganizationState(value);
    setErrorMessage(null);
  }, []);

  const setProject = React.useCallback((value: string) => {
    setProjectState(value);
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
      const resolvedInput = resolveRuntimeQueryInput(queryInput, {
        organization,
        project
      });

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
      setErrorMessage(error instanceof Error ? error.message : "Query konnte nicht geladen werden.");
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  }, [
    completeInitialQueryOnboarding,
    loading,
    organization,
    params,
    project,
    queryInput
  ]);

  return {
    status,
    hydratedPreferences,
    queryInput,
    organization,
    project,
    loading,
    statusMessage,
    errorMessage,
    setQueryInput,
    setOrganization,
    setProject,
    submit,
    completeInitialQueryOnboarding
  };
}
