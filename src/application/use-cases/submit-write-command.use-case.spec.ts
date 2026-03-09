import { describe, expect, it, vi } from "vitest";

import type { WriteCommandPort } from "../ports/write-command.port.js";
import type { CliCommandRunner } from "../../adapters/azure-devops/auth/azure-cli-preflight.adapter.js";
import { createPhase1QueryFlow } from "../../app/composition/phase1-query-flow.js";
import { QueryId } from "../../domain/query-runtime/value-objects/query-id.js";
import { SubmitWriteCommandUseCase } from "./submit-write-command.use-case.js";

describe("SubmitWriteCommandUseCase", () => {
  it("returns deterministic NO_OP when write capability is disabled", async () => {
    const port: WriteCommandPort = {
      submit: vi.fn(async () => ({
        accepted: true,
        mode: "EXECUTED" as const,
        commandKind: "WORK_ITEM_PATCH" as const,
        operationCount: 1,
        reasonCode: "WRITE_ENABLED" as const
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
        mode: "EXECUTED" as const,
        commandKind: "DEPENDENCY_LINK" as const,
        operationCount: 1,
        reasonCode: "WRITE_ENABLED" as const
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
        mode: "EXECUTED" as const,
        commandKind: "WORK_ITEM_PATCH" as const,
        operationCount: 2,
        reasonCode: "WRITE_ENABLED" as const
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

describe("phase1 composition write capability wiring", () => {
  const flowParams = {
    httpClient: {
      get: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({})
      }))
    },
    contextFilePath: "/tmp/ado-context.json",
    mappingFilePath: "/tmp/mapping-settings.json",
    authPreflightRunner: {
      run: vi.fn(async (command: string) => {
        if (command.endsWith("--version")) {
          return { stdout: "azure-cli 2.0", stderr: "", exitCode: 0 };
        }
        if (command.includes("extension show --name azure-devops")) {
          return { stdout: '{"name":"azure-devops"}', stderr: "", exitCode: 0 };
        }
        if (command.includes("account show -o json")) {
          return { stdout: '{"tenantId":"abc"}', stderr: "", exitCode: 0 };
        }
        if (command.includes("devops configure --list")) {
          return {
            stdout: "[defaults]\norganization = https://dev.azure.com/contoso\nproject = delivery",
            stderr: "",
            exitCode: 0
          };
        }
        return { stdout: "", stderr: "unexpected command", exitCode: 1 };
      })
    } as CliCommandRunner
  };

  it("defaults write capability to disabled when flag is missing", () => {
    const flow = createPhase1QueryFlow(flowParams);

    expect(flow.capabilities.writeEnabled).toBe(false);
    expect(typeof flow.runQueryIntake.execute).toBe("function");
  });

  it("keeps disabled write capability when explicitly false", () => {
    const flow = createPhase1QueryFlow({ ...flowParams, capabilities: { writeEnabled: false } });

    expect(flow.capabilities.writeEnabled).toBe(false);
    expect(typeof flow.runQueryIntake.execute).toBe("function");
  });

  it(
    "keeps read/write boundaries isolated in composition contract",
    async () => {
      const flow = createPhase1QueryFlow(flowParams);

      expect(typeof flow.runQueryIntake.execute).toBe("function");
      expect(typeof flow.submitWriteCommand.execute).toBe("function");

      const command = {
        kind: "WORK_ITEM_PATCH" as const,
        workItemId: 7,
        operations: [{ op: "replace" as const, path: "/fields/System.Title", value: "t" }]
      };

      const writeResult = await flow.submitWriteCommand.execute({
        command,
        writeEnabled: flow.capabilities.writeEnabled
      });

      expect(writeResult.mode).toBe("NO_OP");

      await expect(
        flow.runQueryIntake.execute({
          context: {
            organization: "contoso",
            project: "delivery",
            queryId: QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95")
          }
        })
      ).resolves.toBeDefined();
    },
    15000
  );

  it(
    "keeps read intake callable before and after disabled write submissions",
    async () => {
      const flow = createPhase1QueryFlow(flowParams);

      await expect(
        flow.runQueryIntake.execute({
          context: {
            organization: "contoso",
            project: "delivery",
            queryId: QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95")
          }
        })
      ).resolves.toBeDefined();

      await flow.submitWriteCommand.execute({
        command: {
          kind: "WORK_ITEM_PATCH",
          workItemId: 100,
          operations: [{ op: "replace", path: "/fields/System.Title", value: "noop" }]
        },
        writeEnabled: flow.capabilities.writeEnabled
      });

      await expect(
        flow.runQueryIntake.execute({
          context: {
            organization: "contoso",
            project: "delivery",
            queryId: QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95")
          }
        })
      ).resolves.toBeDefined();
    },
    15000
  );

  it(
    "keeps deterministic NO_OP shape independent of prior read activity",
    async () => {
      const flow = createPhase1QueryFlow(flowParams);

      await flow.runQueryIntake.execute({
        context: {
          organization: "contoso",
          project: "delivery",
          queryId: QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95")
        }
      });

      const result = await flow.submitWriteCommand.execute({
        command: {
          kind: "DEPENDENCY_LINK",
          sourceId: 11,
          targetId: 12,
          relation: "System.LinkTypes.Dependency-Forward",
          action: "add"
        },
        writeEnabled: flow.capabilities.writeEnabled
      });

      expect(result).toEqual({
        accepted: false,
        mode: "NO_OP",
        commandKind: "DEPENDENCY_LINK",
        operationCount: 1,
        reasonCode: "WRITE_DISABLED"
      });
    },
    15000
  );

  it("guards against write adapter internals leaking into composition surface", () => {
    const flow = createPhase1QueryFlow(flowParams) as unknown as Record<string, unknown>;

    expect(flow).not.toHaveProperty("writeCommandPort");
    expect(Object.keys(flow).sort()).toEqual(["capabilities", "runQueryIntake", "submitWriteCommand"].sort());
  });
});
