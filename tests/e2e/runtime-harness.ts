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

type UserPreferences = Record<string, unknown>;

type HarnessApi = {
  __phase6Configure: (responses: unknown[]) => void;
  __phase6Mount: () => void;
  __phase6Read: () => {
    callLog: Array<{ queryInput: string }>;
    density: string | null;
    liveSyncEnabled: string | null;
    adoEntries: AdoLogEntry[];
  };
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

const USER_PREFERENCES_ENDPOINT = "/phase2/user-preferences";
const USER_PREFERENCES_SESSION_KEY = "azure-ganttops.e2e.user-preferences";

installUserPreferencesFetchMock();

function ensureContainer(): HTMLElement {
  const element = document.getElementById("app");
  if (!element) {
    throw new Error("Harness container #app is missing");
  }

  return element;
}

function installUserPreferencesFetchMock(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isUserPreferencesRequest(input)) {
      return originalFetch(input, init);
    }

    const method = resolveRequestMethod(input, init);
    if (method === "GET") {
      return jsonResponse(200, {
        preferences: readUserPreferences()
      });
    }

    if (method === "POST") {
      const patch = await readUserPreferencesPatch(input, init);
      if (!patch) {
        return jsonResponse(400, {
          code: "INVALID_INPUT",
          message: "Provide preferences as an object."
        });
      }

      const preferences = {
        ...readUserPreferences(),
        ...patch
      };
      writeUserPreferences(preferences);
      return jsonResponse(200, {
        status: "OK",
        preferences
      });
    }

    return jsonResponse(405, {
      code: "METHOD_NOT_ALLOWED",
      message: "Unsupported method."
    });
  };
}

function isUserPreferencesRequest(input: RequestInfo | URL): boolean {
  const url =
    typeof input === "string"
      ? new URL(input, window.location.href)
      : input instanceof URL
        ? new URL(input.href, window.location.href)
        : new URL(input.url, window.location.href);

  return url.origin === window.location.origin && url.pathname === USER_PREFERENCES_ENDPOINT;
}

function resolveRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (typeof init?.method === "string") {
    return init.method.toUpperCase();
  }

  if (input instanceof Request) {
    return input.method.toUpperCase();
  }

  return "GET";
}

async function readUserPreferencesPatch(input: RequestInfo | URL, init?: RequestInit): Promise<UserPreferences | null> {
  const rawBody =
    typeof init?.body === "string"
      ? init.body
      : input instanceof Request
        ? await input.clone().text()
        : "";

  try {
    const payload = JSON.parse(rawBody) as { preferences?: unknown };
    return isPlainRecord(payload.preferences) ? payload.preferences : null;
  } catch {
    return null;
  }
}

function readUserPreferences(): UserPreferences {
  try {
    const raw = window.sessionStorage.getItem(USER_PREFERENCES_SESSION_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    return isPlainRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeUserPreferences(preferences: UserPreferences): void {
  window.sessionStorage.setItem(USER_PREFERENCES_SESSION_KEY, JSON.stringify(preferences));
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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
      fetchWorkItemStateOptions: async () => ({
        states: [
          { name: "To Do", color: "b2b2b2" },
          { name: "Active", color: "007acc" },
          { name: "Closed", color: "339933" }
        ]
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
  liveSyncEnabled: window.localStorage.getItem("azure-ganttops.timeline-live-sync-enabled"),
  adoEntries: [...state.adoEntries]
});
