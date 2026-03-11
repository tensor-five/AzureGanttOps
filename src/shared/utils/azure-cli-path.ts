import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const MAX_AZ_CLI_PATH_LENGTH = 1024;
const INVALID_CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const INVALID_SHELL_META_PATTERN = /['"`|;&]/;

export function normalizeConfiguredAzCliPath(candidate: string | undefined): string | null {
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > MAX_AZ_CLI_PATH_LENGTH) {
    return null;
  }

  if (INVALID_CONTROL_CHAR_PATTERN.test(trimmed)) {
    return null;
  }

  if (INVALID_SHELL_META_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export async function resolveAzCliExecutablePath(): Promise<string> {
  const configured = normalizeConfiguredAzCliPath(process.env.ADO_AZ_CLI_PATH);
  if (configured) {
    return configured;
  }

  if (process.env.ADO_AZ_CLI_PATH && process.env.ADO_VERBOSE_LOGS === "1") {
    console.warn("[ado-runtime] Ignoring invalid ADO_AZ_CLI_PATH value.");
  }

  if (process.platform !== "win32") {
    return "az";
  }

  const fromPowerShell = await resolveFromPowerShellGetCommand();
  if (fromPowerShell) {
    return fromPowerShell;
  }

  const fromWhereCmd = await resolveFromWhere("where az.cmd");
  if (fromWhereCmd) {
    return fromWhereCmd;
  }

  const fromWhereAz = await resolveFromWhere("where az");
  if (fromWhereAz) {
    return fromWhereAz;
  }

  return "az";
}

export function buildAzCommand(executablePath: string, args: string[]): string {
  return `${shellQuote(executablePath)} ${args.map((arg) => shellQuote(arg)).join(" ")}`;
}

function shellQuote(input: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(input)) {
    return input;
  }

  return `"${input.replace(/["\\$`]/g, "\\$&")}"`;
}

async function resolveFromPowerShellGetCommand(): Promise<string | null> {
  const command =
    'powershell -NoLogo -NonInteractive -Command "(Get-Command az -ErrorAction SilentlyContinue).Source"';

  try {
    const result = await execAsync(command, {
      timeout: 10_000,
      windowsHide: true
    });
    const output = sanitizeOutput(result.stdout);
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

async function resolveFromWhere(command: string): Promise<string | null> {
  try {
    const result = await execAsync(command, {
      timeout: 10_000,
      windowsHide: true
    });
    const output = sanitizeOutput(result.stdout);
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

function sanitizeOutput(stdout: string): string {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
}
