import React from "react";

import { CHANGELOG_PATH } from "../../shared/project-meta/project-meta.js";

export type ChangelogLoadState =
  | { status: "idle"; content: ""; error: null }
  | { status: "loading"; content: ""; error: null }
  | { status: "loaded"; content: string; error: null }
  | { status: "error"; content: ""; error: string };

export async function loadAppChangelogMarkdown(signal: AbortSignal): Promise<string> {
  const response = await fetch(CHANGELOG_PATH, {
    headers: {
      accept: "text/markdown"
    },
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    throw new Error(`Changelog request failed with status ${response.status}`);
  }

  return response.text();
}

export function useAppChangelogLoader(open: boolean): ChangelogLoadState {
  const requestIdRef = React.useRef(0);
  const [loadState, setLoadState] = React.useState<ChangelogLoadState>({
    status: "idle",
    content: "",
    error: null
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const abortController = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoadState({ status: "loading", content: "", error: null });

    void loadAppChangelogMarkdown(abortController.signal)
      .then((content) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setLoadState({ status: "loaded", content, error: null });
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId || isAbortError(error)) {
          return;
        }

        const message = error instanceof Error ? error.message : "Changelog konnte nicht geladen werden.";
        setLoadState({ status: "error", content: "", error: message });
      });

    return () => {
      abortController.abort();
      requestIdRef.current += 1;
    };
  }, [open]);

  return loadState;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
