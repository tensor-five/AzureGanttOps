import { createUiShellComposition } from "../../dist/src/app/composition/ui-shell.composition.js";
import { bootstrapUiClient } from "../../dist/src/app/bootstrap/ui-client.js";

type HarnessState = {
  queue: unknown[];
  latest: unknown;
  callLog: Array<{ queryInput: string }>;
};

type HarnessApi = {
  __phase6Configure: (responses: unknown[]) => void;
  __phase6Mount: () => void;
  __phase6Read: () => { callLog: Array<{ queryInput: string }>; density: string | null };
};

declare global {
  interface Window extends HarnessApi {}
}

const state: HarnessState = {
  queue: [],
  latest: null,
  callLog: []
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
};

window.__phase6Mount = () => {
  const container = ensureContainer();
  container.innerHTML = "";

  const composition = createUiShellComposition({
    controller: {
      submit: async (request) => {
        state.callLog.push({ queryInput: request.queryInput });

        const next = state.queue.shift() ?? state.latest;
        state.latest = next;
        return next as never;
      }
    }
  });

  bootstrapUiClient({
    container,
    composition
  });
};

window.__phase6Read = () => ({
  callLog: [...state.callLog],
  density: window.localStorage.getItem("azure-ganttops.timeline-density")
});
