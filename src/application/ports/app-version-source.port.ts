import type { AppUpdateCheckSource } from "../../shared/project-meta/app-update-check.js";

export type AppVersionSourcePort = {
  readonly source: AppUpdateCheckSource;
  loadLatestVersion: () => Promise<string>;
};
