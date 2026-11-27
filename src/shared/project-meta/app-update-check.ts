export type AppUpdateCheckSource = "github";

export type AppUpdateUnavailableReason =
  | "current_version_malformed"
  | "latest_version_malformed"
  | "version_source_failed";

export type AppUpdateCheckResponse =
  | {
      status: "current";
      currentVersion: string;
      latestVersion: string;
      checkedAt: string;
      source: AppUpdateCheckSource;
    }
  | {
      status: "update_available";
      currentVersion: string;
      latestVersion: string;
      checkedAt: string;
      source: AppUpdateCheckSource;
    }
  | {
      status: "unavailable";
      currentVersion: string;
      latestVersion?: string;
      checkedAt: string;
      source: AppUpdateCheckSource;
      reason: AppUpdateUnavailableReason;
    };

export type AppUpdateNotice = {
  currentVersion: string;
  latestVersion: string;
  checkedAt: string;
  source: AppUpdateCheckSource;
};
