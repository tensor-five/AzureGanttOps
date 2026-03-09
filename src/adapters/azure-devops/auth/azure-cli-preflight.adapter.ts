import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { AuthPreflightPort } from "../../../application/ports/auth-preflight.port.js";
import { resolveAzCliExecutablePath } from "../../../shared/utils/azure-cli-path.js";

const execAsync = promisify(exec);

export type PreflightStatus =
  | "READY"
  | "CLI_NOT_FOUND"
  | "MISSING_EXTENSION"
  | "SESSION_EXPIRED"
  | "CONTEXT_MISMATCH"
  | "UNKNOWN_ERROR";

export type PreflightContext = {
  organization: string;
  project: string;
};

export type PreflightResult = {
  status: PreflightStatus;
  reason?: string;
};

export interface CliCommandRunner {
  run(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}

export class AzureCliPreflightAdapter implements AuthPreflightPort {
  public constructor(
    private readonly runner: CliCommandRunner = new NodeCliCommandRunner()
  ) {}

  public async check(context: PreflightContext): Promise<PreflightResult> {
    const azExecutable = await resolveAzCliExecutablePath();

    const cli = await this.runner.run(buildAzCommand(azExecutable, "--version"));
    logPreflightStep(buildAzCommand(azExecutable, "--version"), cli);

    if (cli.exitCode !== 0) {
      return { status: "CLI_NOT_FOUND" };
    }

    const extension = await this.runner.run(buildAzCommand(azExecutable, "extension show --name azure-devops -o json"));
    logPreflightStep(buildAzCommand(azExecutable, "extension show --name azure-devops -o json"), extension);

    if (extension.exitCode !== 0) {
      return { status: "MISSING_EXTENSION" };
    }

    const session = await this.runner.run(buildAzCommand(azExecutable, "account show -o json"));
    logPreflightStep(buildAzCommand(azExecutable, "account show -o json"), session);

    if (session.exitCode !== 0) {
      return { status: "SESSION_EXPIRED" };
    }

    const defaults = await this.runner.run(buildAzCommand(azExecutable, "devops configure --list"));
    logPreflightStep(buildAzCommand(azExecutable, "devops configure --list"), defaults);

    if (defaults.exitCode !== 0) {
      return {
        status: "UNKNOWN_ERROR",
        reason: "unable to read devops defaults"
      };
    }

    const parsedDefaults = parseDefaults(defaults.stdout);
    logPreflightContext(context, parsedDefaults);

    if (!matchesContext(parsedDefaults.organization, parsedDefaults.project, context)) {
      return { status: "CONTEXT_MISMATCH" };
    }

    return { status: "READY" };
  }
}

function logPreflightStep(
  command: string,
  result: {
    stdout: string;
    stderr: string;
    exitCode: number;
  }
): void {
  if (process.env.ADO_VERBOSE_LOGS !== "1") {
    return;
  }

  const stdout = sanitizeLogText(result.stdout).slice(0, 400);
  const stderr = sanitizeLogText(result.stderr).slice(0, 400);
  console.log(
    `[ado-preflight] ${command} exit=${result.exitCode} stdout=${JSON.stringify(stdout)} stderr=${JSON.stringify(stderr)}`
  );
}

function logPreflightContext(
  expected: PreflightContext,
  configured: { organization: string; project: string }
): void {
  if (process.env.ADO_VERBOSE_LOGS !== "1") {
    return;
  }

  console.log(
    `[ado-preflight] expected org=${JSON.stringify(expected.organization)} project=${JSON.stringify(expected.project)} configured org=${JSON.stringify(configured.organization)} project=${JSON.stringify(configured.project)}`
  );
}

function sanitizeLogText(input: string): string {
  return input.replace(/[\r\n\t]+/g, " ").trim();
}

class NodeCliCommandRunner implements CliCommandRunner {
  public async run(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const output = await execAsync(command, {
        timeout: 10_000,
        windowsHide: true
      });

      return {
        stdout: output.stdout ?? "",
        stderr: output.stderr ?? "",
        exitCode: 0
      };
    } catch (error: unknown) {
      const nodeError = error as {
        stdout?: string;
        stderr?: string;
        code?: string | number;
      };

      return {
        stdout: nodeError.stdout ?? "",
        stderr: nodeError.stderr ?? "",
        exitCode: typeof nodeError.code === "number" ? nodeError.code : 1
      };
    }
  }
}

function parseDefaults(stdout: string): { organization: string; project: string } {
  const organization = getValue(stdout, "organization");
  const project = getValue(stdout, "project");

  return {
    organization,
    project
  };
}

function getValue(stdout: string, key: "organization" | "project"): string {
  const expression = new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, "m");
  const match = stdout.match(expression);

  return match ? match[1].trim() : "";
}

function matchesContext(
  configuredOrganization: string,
  configuredProject: string,
  expected: PreflightContext
): boolean {
  if (!configuredOrganization) {
    // Defaults are optional; context can be provided via app settings/query URL.
    return true;
  }

  const normalizedConfiguredOrg = configuredOrganization
    .replace(/^https?:\/\/dev\.azure\.com\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
  const normalizedExpectedOrg = expected.organization.trim().toLowerCase();

  if (normalizedConfiguredOrg !== normalizedExpectedOrg) {
    return false;
  }

  const normalizedConfiguredProject = configuredProject.trim().toLowerCase();
  const normalizedExpectedProject = expected.project.trim().toLowerCase();

  if (!normalizedConfiguredProject) {
    return true;
  }

  return normalizedConfiguredProject === normalizedExpectedProject;
}

function buildAzCommand(executablePath: string, args: string): string {
  return `${shellQuote(executablePath)} ${args}`;
}

function shellQuote(input: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(input)) {
    return input;
  }

  return `"${input.replace(/["\\$`]/g, "\\$&")}"`;
}
