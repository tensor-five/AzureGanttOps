import "./local-ui.css";
import { createDefaultUiShellComposition, bootstrapUiClient } from "./ui-client.js";
import type { AdoCommLogEntry } from "../composition/ui-shell.composition.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

const container = document.getElementById("app");

if (!(container instanceof HTMLElement)) {
  throw new Error("Missing required #app container.");
}

const composition = createDefaultUiShellComposition({
  controller: {
    submit: async (request) => {
      const response = await fetch("/phase2/query-intake", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
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
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
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
    updateWorkItemDetails: async ({ targetWorkItemId, title, descriptionHtml }) => {
      const response = await fetch("/phase2/work-item-details-update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          targetWorkItemId,
          title,
          descriptionHtml
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
    }
  }
});

bootstrapUiClient({
  container,
  composition
});
