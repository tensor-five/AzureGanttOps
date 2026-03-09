import { createUiShellComposition } from "../../dist/src/app/composition/ui-shell.composition.js";
import { bootstrapUiClient } from "../../dist/src/app/bootstrap/ui-client.js";

type AdoLogEntry = {
  seq: number;
  timestamp: string;
  direction: "request" | "response";
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  preview: string;
};

type HarnessState = {
  queue: unknown[];
  latest: unknown;
  callLog: Array<{ queryInput: string }>;
  adoEntries: AdoLogEntry[];
  adoSeq: number;
};

type HarnessApi = {
  __phase6Configure: (responses: unknown[]) => void;
  __phase6Mount: () => void;
  __phase6Read: () => { callLog: Array<{ queryInput: string }>; density: string | null; adoEntries: AdoLogEntry[] };
};

declare global {
  interface Window extends HarnessApi {}
}

const state: HarnessState = {
  queue: [],
  latest: null,
  callLog: [],
  adoEntries: [],
  adoSeq: 0
};

function ensureContainer(): HTMLElement {
  const element = document.getElementById("app");
  if (!element) {
    throw new Error("Harness container #app is missing");
  }

  return element;
}

window.__phase6Configure = (responses) => {
  state.queue = [...responses];
  state.latest = responses[0] ?? null;
  state.callLog = [];
  state.adoEntries = [];
  state.adoSeq = 0;
};

function appendAdoRequestLog(queryInput: string): void {
  state.adoSeq += 1;
  state.adoEntries.push({
    seq: state.adoSeq,
    timestamp: new Date().toISOString(),
    direction: "request",
    method: "GET",
    url: `/_apis/wit/wiql/${encodeURIComponent(queryInput)}?api-version=7.1&token=%5BREDACTED%5D`,
    status: null,
    durationMs: null,
    preview: ""
  });
}

function appendAdoResponseLog(queryInput: string): void {
  state.adoSeq += 1;
  state.adoEntries.push({
    seq: state.adoSeq,
    timestamp: new Date().toISOString(),
    direction: "response",
    method: "GET",
    url: `/_apis/wit/wiql/${encodeURIComponent(queryInput)}?api-version=7.1&token=%5BREDACTED%5D`,
    status: 200,
    durationMs: 12,
    preview: `query=${queryInput}`
  });
}

function readAdoEntries(afterSeq: number, limit: number): { entries: AdoLogEntry[]; nextSeq: number } {
  const boundedLimit = Math.min(Math.max(limit, 1), 200);
  const entries = state.adoEntries.filter((entry) => entry.seq > afterSeq).slice(0, boundedLimit);
  return {
    entries,
    nextSeq: entries.length > 0 ? entries[entries.length - 1].seq : afterSeq
  };
}

window.__phase6Mount = () => {
  const container = ensureContainer();
  container.innerHTML = "";

  const composition = createUiShellComposition({
    controller: {
      submit: async (request) => {
        state.callLog.push({ queryInput: request.queryInput });
        appendAdoRequestLog(request.queryInput);

        const next = state.queue.shift() ?? state.latest;
        state.latest = next;

        appendAdoResponseLog(request.queryInput);
        return next as never;
      },
      fetchAdoCommLogs: async ({ afterSeq, limit }) => readAdoEntries(afterSeq, limit),
      adoptWorkItemSchedule: async () => ({
        accepted: true,
        mode: "EXECUTED",
        commandKind: "WORK_ITEM_PATCH",
        operationCount: 2,
        reasonCode: "WRITE_ENABLED"
      }),
      updateWorkItemDetails: async () => ({
        accepted: true,
        mode: "EXECUTED",
        commandKind: "WORK_ITEM_PATCH",
        operationCount: 2,
        reasonCode: "WRITE_ENABLED"
      }),
      authenticateAzureCli: async () => ({
        status: "OK",
        message: "Azure CLI login completed. Retry query intake."
      }),
      setAzureCliPath: async (nextPath) => ({
        status: "OK",
        path: nextPath.trim().length > 0 ? nextPath : "az"
      })
    }
  });

  bootstrapUiClient({
    container,
    composition
  });
};

window.__phase6Read = () => ({
  callLog: [...state.callLog],
  density: window.localStorage.getItem("azure-ganttops.timeline-density"),
  adoEntries: [...state.adoEntries]
});
