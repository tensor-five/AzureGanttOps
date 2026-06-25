import React from "react";

import type { QueryIntakeResponse } from "./query-intake.controller.js";
import {
  persistQueryMappingSelection,
  readPersistedQueryMappingSelection
} from "../field-mapping/query-profile-storage.js";
import { AZURE_SESSION_EXPIRED_QUERY_HINT } from "../../shared/azure-devops/azure-session-recovery.js";
import {
  ORG_KEY,
  PROJECT_KEY,
  QUERY_INPUT_KEY,
  resolveRuntimeQueryInput,
  tryResolveRuntimeQueryInput
} from "./runtime-query-input.js";

export { ORG_KEY, PROJECT_KEY, QUERY_INPUT_KEY, resolveQueryRunInput } from "./runtime-query-input.js";

export type QuerySelectorProps = {
  savedQueries: Array<{
    id: string;
    name: string;
  }>;
  onRun: (request: {
    queryId: string;
    mappingProfileId?: string;
  }) => Promise<QueryIntakeResponse>;
  onNeedsFix: (response: QueryIntakeResponse) => void;
  authStatus: QueryIntakeResponse["preflightStatus"] | null;
  onAuthenticateAzureCli: () => Promise<{
    status: "OK";
    message: string;
  }>;
  onSetAzureCliPath: (path: string) => Promise<{
    status: "OK";
    path: string;
  }>;
};

export const AZ_CLI_PATH_KEY = "azure-ganttops.az-cli-path";

export function QuerySelector(props: QuerySelectorProps): React.ReactElement {
  const [queryInput, setQueryInput] = React.useState(() => readLocalStorage(QUERY_INPUT_KEY));
  const [organization, setOrganization] = React.useState(() => readLocalStorage(ORG_KEY));
  const [project, setProject] = React.useState(() => readLocalStorage(PROJECT_KEY));
  const [azCliPath, setAzCliPath] = React.useState(() => readLocalStorage(AZ_CLI_PATH_KEY));
  const [queryInputError, setQueryInputError] = React.useState<string | null>(null);
  const [authInFlight, setAuthInFlight] = React.useState(false);
  const [authMessage, setAuthMessage] = React.useState<string | null>(null);
  const [pathInFlight, setPathInFlight] = React.useState(false);
  const [pathMessage, setPathMessage] = React.useState<string | null>(null);

  const resolvedQueryInput = React.useMemo(
    () => tryResolveRuntimeQueryInput(queryInput, { organization, project }),
    [queryInput, organization, project]
  );

  const hasContext =
    resolvedQueryInput !== null &&
    resolvedQueryInput.resolvedContext.queryId.length > 0 &&
    resolvedQueryInput.resolvedContext.organization.length > 0 &&
    resolvedQueryInput.resolvedContext.project.length > 0;

  const runQuery = React.useCallback(
    async (rawInput: string) => {
      let resolved;
      try {
        resolved = resolveRuntimeQueryInput(rawInput, { organization, project });
      } catch (error) {
        setQueryInputError(error instanceof Error ? error.message : "Invalid query input.");
        return;
      }

      setQueryInputError(null);

      const persisted = readPersistedQueryMappingSelection(resolved.resolvedContext.queryId);

      const response = await props.onRun({
        queryId: resolved.transportQueryInput,
        mappingProfileId: persisted
      });

      persistLocalStorage(QUERY_INPUT_KEY, resolved.rawInput);
      if (resolved.resolvedContext.organization) {
        persistLocalStorage(ORG_KEY, resolved.resolvedContext.organization);
      }
      if (resolved.resolvedContext.project) {
        persistLocalStorage(PROJECT_KEY, resolved.resolvedContext.project);
      }

      setQueryInput(resolved.resolvedContext.queryId);
      setOrganization(resolved.resolvedContext.organization);
      setProject(resolved.resolvedContext.project);

      if (response.preflightStatus !== "READY") {
        return;
      }

      if (response.activeMappingProfileId) {
        persistQueryMappingSelection(resolved.resolvedContext.queryId, response.activeMappingProfileId);
      }

      if (
        response.preflightStatus === "READY" &&
        response.statusCode === "OK" &&
        response.mappingValidation.status === "invalid"
      ) {
        props.onNeedsFix(response);
      }
    },
    [organization, project, props]
  );

  const buttons = props.savedQueries.map((query) =>
    React.createElement(
      "button",
      {
        key: query.id,
        type: "button",
        className: "query-selector-button",
        onClick: () => {
          setQueryInput(query.id);
          void runQuery(query.id);
        }
      },
      `${query.name} (${query.id})`
    )
  );

  const showAzureLoginAction = props.authStatus === "SESSION_EXPIRED";
  const showAzPathAction = props.authStatus === "CLI_NOT_FOUND" || props.authStatus === "UNKNOWN_ERROR";

  return React.createElement(
    "section",
    {
      "aria-label": "query-selector",
      className: "query-selector"
    },
    React.createElement(
      "header",
      { className: "query-selector-header" },
      React.createElement("h3", null, "Select saved query"),
      React.createElement(
        "p",
        { className: "query-selector-hint" },
        "Paste full Azure query URL or use Query ID with Organization + Project."
      )
    ),
    React.createElement(
      "div",
      {
        className: "query-context-status",
        "aria-live": "polite"
      },
      React.createElement(
        "span",
        {
          className: "query-context-badge",
          "data-status": hasContext ? "ready" : "incomplete"
        },
        hasContext ? "Ready" : "Incomplete"
      ),
      hasContext && resolvedQueryInput
        ? `Ready: org ${resolvedQueryInput.resolvedContext.organization} | project ${resolvedQueryInput.resolvedContext.project} | query ${resolvedQueryInput.resolvedContext.queryId}`
        : "Context incomplete: provide full URL, or fill Organization + Project + Query ID."
    ),
    React.createElement(
      "div",
      { className: "query-selector-form" },
      React.createElement(
        "label",
        { className: "query-selector-field" },
        "Query URL or Query ID",
        React.createElement("input", {
          className: "query-selector-input",
          "aria-label": "Query ID",
          value: queryInput,
          onChange: (event) => {
            setQueryInput((event.target as HTMLInputElement).value);
            if (queryInputError) {
              setQueryInputError(null);
            }
          }
        })
      ),
      queryInputError
        ? React.createElement(
            "div",
            {
              role: "alert",
              "aria-label": "query-input-error",
              className: "query-selector-error"
            },
            queryInputError
          )
        : null,
      React.createElement(
        "div",
        { className: "query-selector-grid" },
        React.createElement(
          "label",
          { className: "query-selector-field" },
          "Organization",
          React.createElement("input", {
            className: "query-selector-input",
            "aria-label": "Organization",
            value: organization,
            onChange: (event) => {
              setOrganization((event.target as HTMLInputElement).value);
            }
          })
        ),
        React.createElement(
          "label",
          { className: "query-selector-field" },
          "Project",
          React.createElement("input", {
            className: "query-selector-input",
            "aria-label": "Project",
            value: project,
            onChange: (event) => {
              setProject((event.target as HTMLInputElement).value);
            }
          })
        )
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: "query-selector-primary",
          onClick: () => {
            void runQuery(queryInput);
          }
        },
        "Run query by ID"
      ),
      showAzureLoginAction
        ? React.createElement(
            "div",
            { className: "query-selector-auth-action" },
            React.createElement(
              "button",
              {
                type: "button",
                className: "query-selector-secondary",
                disabled: authInFlight,
                onClick: () => {
                  setAuthMessage(null);
                  setAuthInFlight(true);
                  void props.onAuthenticateAzureCli()
                    .then((result) => {
                      setAuthMessage(result.message);
                    })
                    .catch((error: unknown) => {
                      const message = error instanceof Error ? error.message : "Azure CLI login failed.";
                      setAuthMessage(message);
                    })
                    .finally(() => {
                      setAuthInFlight(false);
                    });
                }
              },
              authInFlight ? "Signing in..." : "Sign in with Azure CLI"
            ),
            React.createElement(
              "div",
              { className: "query-selector-hint" },
              AZURE_SESSION_EXPIRED_QUERY_HINT
            ),
            authMessage
              ? React.createElement(
                  "div",
                  {
                    role: "status",
                    "aria-live": "polite",
                    className: "query-selector-auth-message"
                  },
                  authMessage
                )
              : null
          )
        : null,
      showAzPathAction
        ? React.createElement(
            "div",
            { className: "query-selector-auth-action" },
            React.createElement(
              "label",
              { className: "query-selector-field" },
              "Azure CLI path (optional override)",
              React.createElement("input", {
                className: "query-selector-input",
                "aria-label": "Azure CLI path",
                placeholder: "Example: C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd",
                value: azCliPath,
                onChange: (event) => {
                  setAzCliPath((event.target as HTMLInputElement).value);
                }
              })
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "query-selector-secondary",
                disabled: pathInFlight,
                onClick: () => {
                  setPathMessage(null);
                  setPathInFlight(true);
                  void props.onSetAzureCliPath(azCliPath)
                    .then((result) => {
                      persistLocalStorage(AZ_CLI_PATH_KEY, azCliPath);
                      setPathMessage(`Azure CLI path set to: ${result.path}`);
                    })
                    .catch((error: unknown) => {
                      const message = error instanceof Error ? error.message : "Failed to set Azure CLI path.";
                      setPathMessage(message);
                    })
                    .finally(() => {
                      setPathInFlight(false);
                    });
                }
              },
              pathInFlight ? "Applying path..." : "Apply CLI path"
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "query-selector-secondary",
                disabled: pathInFlight,
                onClick: () => {
                  setPathMessage(null);
                  setPathInFlight(true);
                  void props.onSetAzureCliPath("")
                    .then((result) => {
                      setAzCliPath(result.path === "az" ? "" : result.path);
                      persistLocalStorage(AZ_CLI_PATH_KEY, result.path === "az" ? "" : result.path);
                      setPathMessage(`Auto-detected Azure CLI path: ${result.path}`);
                    })
                    .catch((error: unknown) => {
                      const message = error instanceof Error ? error.message : "Auto-detect failed.";
                      setPathMessage(message);
                    })
                    .finally(() => {
                      setPathInFlight(false);
                    });
                }
              },
              pathInFlight ? "Detecting..." : "Auto-detect with Get-Command"
            ),
            pathMessage
              ? React.createElement(
                  "div",
                  {
                    role: "status",
                    "aria-live": "polite",
                    className: "query-selector-auth-message"
                  },
                  pathMessage
                )
              : null
          )
        : null
    ),
    React.createElement(
      "section",
      { className: "query-selector-saved" },
      React.createElement("h4", null, "Saved queries"),
      React.createElement("div", { className: "query-selector-list" }, ...buttons)
    )
  );
}

function readLocalStorage(key: string): string {
  if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") {
    return "";
  }

  return localStorage.getItem(key) ?? "";
}

function persistLocalStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined" || typeof localStorage.setItem !== "function") {
    return;
  }

  try {
    localStorage.setItem(key, value.trim());
  } catch {
    // Compatibility writes are best-effort; the active run already succeeded.
  }
}
