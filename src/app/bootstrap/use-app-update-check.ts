import React from "react";

import type {
  AppUpdateCheckResponse,
  AppUpdateNotice
} from "../../shared/project-meta/app-update-check.js";

export type UseAppUpdateCheckResult = {
  updateNotice: AppUpdateNotice | null;
  trigger: () => void;
};

export function useAppUpdateCheck(params: {
  checkAppUpdate: () => Promise<AppUpdateCheckResponse>;
}): UseAppUpdateCheckResult {
  const { checkAppUpdate } = params;
  const [updateNotice, setUpdateNotice] = React.useState<AppUpdateNotice | null>(null);
  const mountedRef = React.useRef(true);
  const inFlightRef = React.useRef<Promise<void> | null>(null);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const trigger = React.useCallback(() => {
    if (inFlightRef.current) {
      return;
    }

    const inFlight = Promise.resolve()
      .then(checkAppUpdate)
      .then((response) => {
        if (!mountedRef.current) {
          return;
        }

        if (response.status === "update_available") {
          setUpdateNotice({
            currentVersion: response.currentVersion,
            latestVersion: response.latestVersion,
            checkedAt: response.checkedAt,
            source: response.source
          });
          return;
        }

        if (response.status === "current") {
          setUpdateNotice(null);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (inFlightRef.current === inFlight) {
          inFlightRef.current = null;
        }
      });

    inFlightRef.current = inFlight;
  }, [checkAppUpdate]);

  return {
    updateNotice,
    trigger
  };
}
