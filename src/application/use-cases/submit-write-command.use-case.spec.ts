import { describe, expect, it, vi } from "vitest";

import type { WriteCommandPort } from "../ports/write-command.port.js";
import { SubmitWriteCommandUseCase } from "./submit-write-command.use-case.js";

describe("SubmitWriteCommandUseCase", () => {
  it("returns deterministic NO_OP when write capability is disabled", async () => {
    const port: WriteCommandPort = {
      submit: vi.fn(async () => ({
        accepted: true,
        mode: "EXECUTED",
        commandKind: "WORK_ITEM_PATCH",
        operationCount: 1,
        reasonCode: "WRITE_ENABLED"
      }))
    };

    const useCase = new SubmitWriteCommandUseCase(port);

    const result = await useCase.execute({
      command: {
        kind: "WORK_ITEM_PATCH",
        workItemId: 42,
        operations: [{ op: "replace", path: "/fields/System.Title", value: "Updated" }]
      },
      writeEnabled: false
    });

    expect(result).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 1,
      reasonCode: "WRITE_DISABLED"
    });
    expect(port.submit).not.toHaveBeenCalled();
  });

  it("defaults missing writeEnabled to disabled NO_OP", async () => {
    const port: WriteCommandPort = {
      submit: vi.fn(async () => ({
        accepted: true,
        mode: "EXECUTED",
        commandKind: "DEPENDENCY_LINK",
        operationCount: 1,
        reasonCode: "WRITE_ENABLED"
      }))
    };

    const useCase = new SubmitWriteCommandUseCase(port);

    const result = await useCase.execute({
      command: {
        kind: "DEPENDENCY_LINK",
        sourceId: 10,
        targetId: 11,
        relation: "System.LinkTypes.Dependency-Forward",
        action: "add"
      }
    });

    expect(result).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "DEPENDENCY_LINK",
      operationCount: 1,
      reasonCode: "WRITE_DISABLED"
    });
    expect(port.submit).not.toHaveBeenCalled();
  });

  it("delegates to port when write is enabled", async () => {
    const port: WriteCommandPort = {
      submit: vi.fn(async () => ({
        accepted: true,
        mode: "EXECUTED",
        commandKind: "WORK_ITEM_PATCH",
        operationCount: 2,
        reasonCode: "WRITE_ENABLED"
      }))
    };

    const useCase = new SubmitWriteCommandUseCase(port);

    const command = {
      kind: "WORK_ITEM_PATCH" as const,
      workItemId: 99,
      operations: [
        { op: "test" as const, path: "/rev", value: 5 },
        { op: "replace" as const, path: "/fields/System.Title", value: "Renamed" }
      ]
    };

    const result = await useCase.execute({ command, writeEnabled: true });

    expect(result).toEqual({
      accepted: true,
      mode: "EXECUTED",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 2,
      reasonCode: "WRITE_ENABLED"
    });
    expect(port.submit).toHaveBeenCalledTimes(1);
    expect(port.submit).toHaveBeenCalledWith(command);
  });
});
