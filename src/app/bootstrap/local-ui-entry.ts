import "./local-ui.css";
import { createDefaultUiShellComposition, bootstrapUiClient } from "./ui-client.js";
import type { AdoCommLogEntry } from "../composition/ui-shell.composition.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

const container = document.getElementById("app");
const csrfToken = readCsrfToken();

if (!(container instanceof HTMLElement)) {
  throw new Error("Missing required #app container.");
}

function withCsrf(headers: Record<string, string>): Record<string, string> {
  if (!csrfToken) {
    return headers;
  }

  return {
    ...headers,
    "x-ado-csrf-token": csrfToken
  };
}

function readCsrfToken(): string | null {
  const meta = document.querySelector('meta[name="ado-csrf-token"]');
  if (!(meta instanceof HTMLMetaElement)) {
    return null;
  }

  const token = meta.content.trim();
  return token.length > 0 ? token : null;
}

const composition = createDefaultUiShellComposition({
  controller: {
    submit: async (request) => {
      const response = await fetch("/phase2/query-intake", {
        method: "POST",
        headers: withCsrf({
          "content-type": "application/json",
          accept: "application/json"
        }),
        body: JSON.stringify(request)
      });

      const payload = (await response.json()) as QueryIntakeResponse | { message?: string };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `Query intake failed (${response.status})`;
        throw new Error(message);
      }

      return payload as QueryIntakeResponse;
    },
    fetchAdoCommLogs: async ({ afterSeq, limit }) => {
      const response = await fetch(`/phase2/ado-comm-logs?afterSeq=${afterSeq}&limit=${limit}`, {
        method: "GET",
        headers: {
          accept: "application/json"
        }
      });

      const payload = (await response.json()) as
        | { entries: AdoCommLogEntry[]; nextSeq: number; message?: string }
        | { message?: string };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `ADO communication logs request failed (${response.status})`;
        throw new Error(message);
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray((payload as { entries?: unknown }).entries) ||
        typeof (payload as { nextSeq?: unknown }).nextSeq !== "number"
      ) {
        throw new Error("ADO communication logs response is malformed");
      }

      return {
        entries: (payload as { entries: AdoCommLogEntry[] }).entries,
        nextSeq: (payload as { nextSeq: number }).nextSeq
      };
    },
    adoptWorkItemSchedule: async ({ targetWorkItemId, startDate, endDate }) => {
      const response = await fetch("/phase2/work-item-schedule-adopt", {
        method: "POST",
        headers: withCsrf({
          "content-type": "application/json",
          accept: "application/json"
        }),
        body: JSON.stringify({
          targetWorkItemId,
          startDate,
          endDate
        })
      });

      const payload = (await response.json()) as
        | {
            accepted: boolean;
            mode: "NO_OP" | "EXECUTED";
            commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK";
            operationCount: number;
            reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
          }
        | { message?: string; result?: { reasonCode?: string } };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `Work item update failed (${response.status})`;
        throw new Error(message);
      }

      return payload as {
        accepted: boolean;
        mode: "NO_OP" | "EXECUTED";
        commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK";
        operationCount: number;
        reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
      };
    },
    linkDependency: async ({ predecessorWorkItemId, successorWorkItemId, action }) => {
      const response = await fetch("/phase2/dependency-link", {
        method: "POST",
        headers: withCsrf({
          "content-type": "application/json",
          accept: "application/json"
        }),
        body: JSON.stringify({
          predecessorWorkItemId,
          successorWorkItemId,
          action
        })
      });

      const payload = (await response.json()) as
        | {
            accepted: boolean;
            mode: "NO_OP" | "EXECUTED";
            commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK";
            operationCount: number;
            reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
          }
        | { message?: string; result?: { reasonCode?: string } };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `Dependency link failed (${response.status})`;
        throw new Error(message);
      }

      return payload as {
        accepted: boolean;
        mode: "NO_OP" | "EXECUTED";
        commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK";
        operationCount: number;
        reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
      };
    },
    updateWorkItemDetails: async ({ targetWorkItemId, title, descriptionHtml, state }) => {
      const response = await fetch("/phase2/work-item-details-update", {
        method: "POST",
        headers: withCsrf({
          "content-type": "application/json",
          accept: "application/json"
        }),
        body: JSON.stringify({
          targetWorkItemId,
          title,
          descriptionHtml,
          state
        })
      });

      const payload = (await response.json()) as
        | {
            accepted: boolean;
            mode: "NO_OP" | "EXECUTED";
            commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK";
            operationCount: number;
            reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
          }
        | { message?: string; result?: { reasonCode?: string } };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `Work item update failed (${response.status})`;
        throw new Error(message);
      }

      return payload as {
        accepted: boolean;
        mode: "NO_OP" | "EXECUTED";
        commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK";
        operationCount: number;
        reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
      };
    },
    reparentWorkItem: async ({ targetWorkItemId, newParentId }) => {
      const response = await fetch("/phase2/work-item-reparent", {
        method: "POST",
        headers: withCsrf({
          "content-type": "application/json",
          accept: "application/json"
        }),
        body: JSON.stringify({ targetWorkItemId, newParentId })
      });

      const payload = (await response.json()) as
        | {
            accepted: boolean;
            mode: "NO_OP" | "EXECUTED";
            commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK" | "HIERARCHY_LINK";
            operationCount: number;
            reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
          }
        | { message?: string };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `Reparent failed (${response.status})`;
        throw new Error(message);
      }

      return payload as {
        accepted: boolean;
        mode: "NO_OP" | "EXECUTED";
        commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK" | "HIERARCHY_LINK";
        operationCount: number;
        reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
      };
    },
    fetchWorkItemStateOptions: async ({ targetWorkItemId }) => {
      const response = await fetch(`/phase2/work-item-state-options?targetWorkItemId=${encodeURIComponent(String(targetWorkItemId))}`, {
        method: "GET",
        headers: {
          accept: "application/json"
        }
      });

      const payload = (await response.json()) as { states?: unknown; message?: string };
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && typeof payload.message === "string"
            ? payload.message
            : `State options request failed (${response.status})`;
        throw new Error(message);
      }

      const states = Array.isArray(payload.states)
        ? payload.states
            .map((entry) => {
              if (!entry || typeof entry !== "object") {
                return null;
              }

              const name = (entry as { name?: unknown }).name;
              const color = (entry as { color?: unknown }).color;
              if (typeof name !== "string") {
                return null;
              }

              return {
                name,
                color: typeof color === "string" ? color : null
              };
            })
            .filter((entry): entry is { name: string; color: string | null } => entry !== null)
        : [];
      return { states };
    },
    fetchQueryDetails: async ({ queryId }) => {
      const response = await fetch(`/phase2/query-details?queryId=${encodeURIComponent(queryId)}`, {
        method: "GET",
        headers: {
          accept: "application/json"
        }
      });

      const payload = (await response.json()) as {
        id?: unknown;
        name?: unknown;
        path?: unknown;
        message?: string;
      };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && typeof payload.message === "string"
            ? payload.message
            : `Query details request failed (${response.status})`;
        throw new Error(message);
      }

      if (
        typeof payload.id !== "string" ||
        typeof payload.name !== "string" ||
        typeof payload.path !== "string"
      ) {
        throw new Error("Query details response is malformed");
      }

      return {
        id: payload.id,
        name: payload.name,
        path: payload.path
      };
    },
    authenticateAzureCli: async () => {
      const response = await fetch("/phase2/az-login", {
        method: "POST",
        headers: withCsrf({
          accept: "application/json"
        })
      });

      const payload = (await response.json()) as { status?: "OK"; message?: string };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && typeof payload.message === "string"
            ? payload.message
            : `Azure login failed (${response.status})`;
        throw new Error(message);
      }

      return {
        status: "OK" as const,
        message: typeof payload.message === "string" ? payload.message : "Azure CLI login completed."
      };
    },
    setAzureCliPath: async (path) => {
      const response = await fetch("/phase2/az-cli-path", {
        method: "POST",
        headers: withCsrf({
          "content-type": "application/json",
          accept: "application/json"
        }),
        body: JSON.stringify({ path })
      });

      const payload = (await response.json()) as { status?: "OK"; path?: string; message?: string };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && typeof payload.message === "string"
            ? payload.message
            : `Azure CLI path update failed (${response.status})`;
        throw new Error(message);
      }

      return {
        status: "OK" as const,
        path: typeof payload.path === "string" ? payload.path : "az"
      };
    }
  }
});

bootstrapUiClient({
  container,
  composition
});
