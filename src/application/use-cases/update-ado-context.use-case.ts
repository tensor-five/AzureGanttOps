import type { AdoContext, ContextSettingsPort } from "../ports/context-settings.port.js";

export class UpdateAdoContextUseCase {
  public constructor(private readonly settingsPort: ContextSettingsPort) {}

  public async execute(input: AdoContext): Promise<AdoContext> {
    const organization = normalizeRequired(input.organization, "organization");
    const project = normalizeRequired(input.project, "project");

    const normalized = {
      organization,
      project
    };

    await this.settingsPort.saveContext(normalized);
    return normalized;
  }
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}
