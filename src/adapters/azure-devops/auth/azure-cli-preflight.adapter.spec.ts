import { describe, expect, it } from "vitest";

import {
  AzureCliPreflightAdapter,
  type CliCommandRunner,
  type PreflightContext
} from "./azure-cli-preflight.adapter.js";

type RunnerResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

describe("AzureCliPreflightAdapter", () => {
  const context: PreflightContext = {
    organization: "contoso",
    project: "delivery"
  };

  it("returns READY when cli, extension, session, and defaults are valid", async () => {
    const adapter = new AzureCliPreflightAdapter(makeRunner((command) => {
      if (command === "az --version") {
        return ok("azure-cli 2.0");
      }

      if (command === "az extension show --name azure-devops -o json") {
        return ok('{"name":"azure-devops"}');
      }

      if (command === "az account show -o json") {
        return ok('{"tenantId":"abc"}');
      }

      if (command === "az devops configure --list") {
        return ok("[defaults]\norganization = https://dev.azure.com/contoso\nproject = delivery");
      }

      throw new Error(`unexpected command: ${command}`);
    }));

    await expect(adapter.check(context)).resolves.toEqual({
      status: "READY"
    });
  });

  it("maps missing extension to MISSING_EXTENSION", async () => {
    const adapter = new AzureCliPreflightAdapter(makeRunner((command) => {
      if (command === "az --version") {
        return ok("azure-cli 2.0");
      }

      if (command === "az extension show --name azure-devops -o json") {
        return fail("No extension found", 1);
      }

      throw new Error(`unexpected command: ${command}`);
    }));

    await expect(adapter.check(context)).resolves.toEqual({
      status: "MISSING_EXTENSION"
    });
  });

  it("maps auth failure to SESSION_EXPIRED", async () => {
    const adapter = new AzureCliPreflightAdapter(makeRunner((command) => {
      if (command === "az --version") {
        return ok("azure-cli 2.0");
      }

      if (command === "az extension show --name azure-devops -o json") {
        return ok('{"name":"azure-devops"}');
      }

      if (command === "az account show -o json") {
        return fail("ERROR: Please run 'az login'", 1);
      }

      throw new Error(`unexpected command: ${command}`);
    }));

    await expect(adapter.check(context)).resolves.toEqual({
      status: "SESSION_EXPIRED"
    });
  });

  it("maps default mismatch to CONTEXT_MISMATCH", async () => {
    const adapter = new AzureCliPreflightAdapter(makeRunner((command) => {
      if (command === "az --version") {
        return ok("azure-cli 2.0");
      }

      if (command === "az extension show --name azure-devops -o json") {
        return ok('{"name":"azure-devops"}');
      }

      if (command === "az account show -o json") {
        return ok('{"tenantId":"abc"}');
      }

      if (command === "az devops configure --list") {
        return ok("[defaults]\norganization = https://dev.azure.com/fabrikam\nproject = wrong");
      }

      throw new Error(`unexpected command: ${command}`);
    }));

    await expect(adapter.check(context)).resolves.toEqual({
      status: "CONTEXT_MISMATCH"
    });
  });

  it("maps missing cli to CLI_NOT_FOUND", async () => {
    const adapter = new AzureCliPreflightAdapter(makeRunner((command) => {
      if (command === "az --version") {
        return fail("command not found: az", 127);
      }

      throw new Error(`unexpected command: ${command}`);
    }));

    await expect(adapter.check(context)).resolves.toEqual({
      status: "CLI_NOT_FOUND"
    });
  });

  it("maps unknown failure to UNKNOWN_ERROR", async () => {
    const adapter = new AzureCliPreflightAdapter(makeRunner((command) => {
      if (command === "az --version") {
        return ok("azure-cli 2.0");
      }

      if (command === "az extension show --name azure-devops -o json") {
        return ok('{"name":"azure-devops"}');
      }

      if (command === "az account show -o json") {
        return ok('{"tenantId":"abc"}');
      }

      if (command === "az devops configure --list") {
        return fail("unexpected transport timeout", 2);
      }

      throw new Error(`unexpected command: ${command}`);
    }));

    const result = await adapter.check(context);
    expect(result.status).toBe("UNKNOWN_ERROR");
  });
});

function ok(stdout: string): RunnerResult {
  return {
    stdout,
    stderr: "",
    exitCode: 0
  };
}

function fail(stderr: string, exitCode: number): RunnerResult {
  return {
    stdout: "",
    stderr,
    exitCode
  };
}

function makeRunner(impl: (command: string) => RunnerResult): CliCommandRunner {
  return {
    run(command: string) {
      return Promise.resolve(impl(command));
    }
  };
}
