import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function resolveAzCliExecutablePath(): Promise<string> {
  const configured = process.env.ADO_AZ_CLI_PATH?.trim();
  if (configured && configured.length > 0) {
    return configured;
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
