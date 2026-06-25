export const LOCAL_CONFIG_RESET_CONFIRMATION = "DELETE ALL CONFIGS";

export type LocalConfigResetTargetStatus = "deleted" | "skipped" | "failed";

export type LocalConfigResetTargetResult = {
  target: string;
  label: string;
  status: LocalConfigResetTargetStatus;
  message: string;
};

export type LocalConfigResetReport = {
  status: "completed" | "partial_failure";
  targets: LocalConfigResetTargetResult[];
};

export type LocalConfigResetTargetOperation = {
  target: string;
  label: string;
  reset: () => Promise<"deleted" | "skipped">;
};

export type LocalConfigResetPort = {
  listTargets: () => readonly LocalConfigResetTargetOperation[];
};
