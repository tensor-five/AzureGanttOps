import {
  LOCAL_CONFIG_RESET_CONFIRMATION,
  type LocalConfigResetPort,
  type LocalConfigResetReport,
  type LocalConfigResetTargetResult
} from "../ports/local-config-reset.port.js";

export class LocalConfigResetConfirmationError extends Error {
  public constructor() {
    super("Local config reset confirmation does not match.");
    this.name = "LocalConfigResetConfirmationError";
  }
}

export class ClearLocalUserConfigsUseCase {
  public constructor(private readonly resetPort: LocalConfigResetPort) {}

  public async execute(input: { confirmation: string }): Promise<LocalConfigResetReport> {
    if (input.confirmation !== LOCAL_CONFIG_RESET_CONFIRMATION) {
      throw new LocalConfigResetConfirmationError();
    }

    const targets: LocalConfigResetTargetResult[] = [];

    for (const target of this.resetPort.listTargets()) {
      try {
        const status = await target.reset();
        targets.push({
          target: target.target,
          label: target.label,
          status,
          message: status === "deleted" ? "Local target cleared." : "Local target was already absent."
        });
      } catch {
        targets.push({
          target: target.target,
          label: target.label,
          status: "failed",
          message: "Local target could not be cleared."
        });
      }
    }

    return {
      status: targets.some((target) => target.status === "failed") ? "partial_failure" : "completed",
      targets
    };
  }
}
