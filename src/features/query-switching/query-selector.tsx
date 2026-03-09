import React from "react";

import type { QueryIntakeResponse } from "./query-intake.controller.js";
import {
  persistQueryMappingSelection,
  proposeDefaultMappingForQuery,
  readPersistedQueryMappingSelection
} from "../field-mapping/mapping-auto-apply.js";

export type QuerySelectorProps = {
  savedQueries: Array<{
    id: string;
    name: string;
  }>;
  availableFieldRefs: string[];
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

type ParsedSelection = {
  queryId: string;
  organization: string;
  project: string;
  source: "url" | "id";
};

export const ORG_KEY = "azure-ganttops.organization";
export const PROJECT_KEY = "azure-ganttops.project";
export const QUERY_INPUT_KEY = "azure-ganttops.query-input";
export const AZ_CLI_PATH_KEY = "azure-ganttops.az-cli-path";
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const parsedSelection = React.useMemo(
    () => parseRuntimeQuerySelection(queryInput, organization, project),
    [queryInput, organization, project]
  );

  const hasContext =
    parsedSelection !== null &&
    parsedSelection.queryId.length > 0 &&
    parsedSelection.organization.length > 0 &&
    parsedSelection.project.length > 0;

  const runQuery = React.useCallback(
    async (rawInput: string) => {
      const normalizedInput = rawInput.trim();
      if (/^[0-9]+$/.test(normalizedInput)) {
        setQueryInputError("Numeric-only input is not a valid query ID. Use a GUID query ID or full Azure DevOps query URL.");
        return;
      }

      const parsed = parseRuntimeQuerySelection(rawInput, organization, project);
      if (!parsed) {
        return;
      }

      setQueryInputError(null);

      const persisted = readPersistedQueryMappingSelection(parsed.queryId);
      const proposal = proposeDefaultMappingForQuery({
        queryId: parsed.queryId,
        availableFieldRefs: props.availableFieldRefs
      });

      const normalizedRawInput = rawInput.trim();
      const transportQueryInput = resolveQueryRunInput(rawInput, organization, project);
      if (!transportQueryInput) {
        return;
      }

      const response = await props.onRun({
        queryId: transportQueryInput,
        mappingProfileId: persisted,
        mappingProfileUpsert: proposal.status === "valid" ? proposal.profile : undefined
      });

      persistLocalStorage(QUERY_INPUT_KEY, normalizedRawInput);
      if (parsed.organization) {
        persistLocalStorage(ORG_KEY, parsed.organization);
      }
      if (parsed.project) {
        persistLocalStorage(PROJECT_KEY, parsed.project);
      }

      setQueryInput(parsed.queryId);
      setOrganization(parsed.organization);
      setProject(parsed.project);

      if (response.preflightStatus !== "READY") {
        return;
      }

      if (response.activeMappingProfileId) {
        persistQueryMappingSelection(parsed.queryId, response.activeMappingProfileId);
      }

      if (
        response.preflightStatus === "READY" &&
        response.statusCode === "OK" &&
        (response.mappingValidation.status === "invalid" || proposal.status === "invalid")
      ) {
        props.onNeedsFix(response);
      }
    },
    [organization, project, props, queryInputError]
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
      hasContext && parsedSelection
        ? `Ready: org ${parsedSelection.organization} | project ${parsedSelection.project} | query ${parsedSelection.queryId}`
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
              "Starts `az login --use-device-code`. Complete sign-in, then run query again."
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

export function resolveQueryRunInput(queryInput: string, organization: string, project: string): string | null {
  const parsed = parseRuntimeQuerySelection(queryInput, organization, project);
  if (!parsed) {
    return null;
  }

  const normalizedRawInput = queryInput.trim();
  return parsed.source === "url"
    ? normalizedRawInput
    : buildQueryInput(parsed.queryId, parsed.organization, parsed.project);
}

function parseRuntimeQuerySelection(input: string, organization: string, project: string): ParsedSelection | null {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    return null;
  }

  const parsedFromUrl = parseAzureQueryUrl(normalizedInput);
  if (parsedFromUrl) {
    return {
      ...parsedFromUrl,
      source: "url"
    };
  }

  return {
    queryId: normalizedInput,
    organization: organization.trim(),
    project: project.trim(),
    source: "id"
  };
}

function parseAzureQueryUrl(input: string): Omit<ParsedSelection, "source"> | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.hostname.toLowerCase() !== "dev.azure.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const organization = (segments[0] ?? "").trim();
  const project = (segments[1] ?? "").trim();
  const queryIdCandidate =
    url.searchParams.get("qid") ?? url.searchParams.get("id") ?? extractGuidFromPath(url.pathname);

  if (!organization || !project || !queryIdCandidate || !GUID_PATTERN.test(queryIdCandidate)) {
    return null;
  }

  return {
    queryId: queryIdCandidate,
    organization,
    project
  };
}

function extractGuidFromPath(pathname: string): string | null {
  const match = pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

function buildQueryInput(queryId: string, organization: string, project: string): string {
  const org = organization.trim();
  const proj = project.trim();

  if (!org || !proj) {
    return queryId;
  }

  return `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_queries/query?qid=${encodeURIComponent(queryId)}`;
}

function readLocalStorage(key: string): string {
  if (typeof localStorage === "undefined") {
    return "";
  }

  return localStorage.getItem(key) ?? "";
}

function persistLocalStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(key, value.trim());
}
