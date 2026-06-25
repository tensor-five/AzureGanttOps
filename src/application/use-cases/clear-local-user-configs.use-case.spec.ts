import { describe, expect, it, vi } from "vitest";

import { LOCAL_CONFIG_RESET_CONFIRMATION, type LocalConfigResetPort } from "../ports/local-config-reset.port.js";
import {
  ClearLocalUserConfigsUseCase,
  LocalConfigResetConfirmationError
} from "./clear-local-user-configs.use-case.js";

describe("ClearLocalUserConfigsUseCase", () => {
  it("requires the exact confirmation phrase", async () => {
    const useCase = new ClearLocalUserConfigsUseCase({
      listTargets: () => []
    });

    await expect(useCase.execute({ confirmation: "delete all configs" })).rejects.toBeInstanceOf(
      LocalConfigResetConfirmationError
    );
  });

  it("returns a target report with deleted, skipped and failed statuses", async () => {
    const port: LocalConfigResetPort = {
      listTargets: () => [
        {
          target: "deleted-target",
          label: "Deleted target",
          reset: vi.fn(async () => "deleted" as const)
        },
        {
          target: "skipped-target",
          label: "Skipped target",
          reset: vi.fn(async () => "skipped" as const)
        },
        {
          target: "failed-target",
          label: "Failed target",
          reset: vi.fn(async () => {
            throw new Error("path details stay private");
          })
        }
      ]
    };
    const useCase = new ClearLocalUserConfigsUseCase(port);

    const report = await useCase.execute({ confirmation: LOCAL_CONFIG_RESET_CONFIRMATION });

    expect(report.status).toBe("partial_failure");
    expect(report.targets).toEqual([
      {
        target: "deleted-target",
        label: "Deleted target",
        status: "deleted",
        message: "Local target cleared."
      },
      {
        target: "skipped-target",
        label: "Skipped target",
        status: "skipped",
        message: "Local target was already absent."
      },
      {
        target: "failed-target",
        label: "Failed target",
        status: "failed",
        message: "Local target could not be cleared."
      }
    ]);
  });
});
