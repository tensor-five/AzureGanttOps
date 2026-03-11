import React from "react";

import type { UiShellComposition } from "../composition/ui-shell.composition.js";

export type AdoCommLogPollingState = {
  logs: Awaited<ReturnType<UiShellComposition["controller"]["fetchAdoCommLogs"]>>["entries"];
  loading: boolean;
  error: string | null;
};

export function useAdoCommLogPolling(input: {
  controller: UiShellComposition["controller"];
  pollIntervalMs: number;
  readLimit: number;
  maxEntries: number;
}): AdoCommLogPollingState {
  const [logs, setLogs] = React.useState<AdoCommLogPollingState["logs"]>([]);
  const [cursor, setCursor] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const inFlightRef = React.useRef(false);

  React.useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;

      try {
        const snapshot = await input.controller.fetchAdoCommLogs({
          afterSeq: cursor,
          limit: input.readLimit
        });

        if (!active) {
          return;
        }

        setLogs((current) => {
          const next = current.concat(snapshot.entries);
          if (next.length > input.maxEntries) {
            return next.slice(next.length - input.maxEntries);
          }

          return next;
        });
        setCursor(snapshot.nextSeq);
        setError(null);
      } catch (pollError) {
        if (!active) {
          return;
        }

        const message = pollError instanceof Error ? pollError.message : "Unable to load Azure communication logs.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }

        inFlightRef.current = false;
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, input.pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [cursor, input.controller, input.maxEntries, input.pollIntervalMs, input.readLimit]);

  return {
    logs,
    loading,
    error
  };
}
