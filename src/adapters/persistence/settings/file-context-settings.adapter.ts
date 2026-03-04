import { promises as fs } from "node:fs";
import path from "node:path";

import type { AdoContext, ContextSettingsPort } from "../../../application/ports/context-settings.port.js";

type PersistedContext = {
  organization: string;
  project: string;
};

export class FileContextSettingsAdapter implements ContextSettingsPort {
  public constructor(private readonly filePath: string) {}

  public async getContext(): Promise<AdoContext | null> {
    let raw: string;

    try {
      raw = await fs.readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }

      throw new Error("Failed to read persisted Azure DevOps context");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Persisted Azure DevOps context is malformed JSON");
    }

    if (!isPersistedContext(parsed)) {
      throw new Error("Persisted Azure DevOps context has invalid shape");
    }

    return {
      organization: parsed.organization.trim(),
      project: parsed.project.trim()
    };
  }

  public async saveContext(context: AdoContext): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const payload: PersistedContext = {
      organization: context.organization,
      project: context.project
    };

    await fs.writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}

function isPersistedContext(value: unknown): value is PersistedContext {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.organization === "string" &&
    candidate.organization.trim().length > 0 &&
    typeof candidate.project === "string" &&
    candidate.project.trim().length > 0
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error) && typeof error === "object" && "code" in error;
}
