import type { AdoContext, ContextSettingsPort } from "../../application/ports/context-settings.port.js";
import { UpdateAdoContextUseCase } from "../../application/use-cases/update-ado-context.use-case.js";

export class AdoContextStore {
  private readonly updateUseCase: UpdateAdoContextUseCase;

  public constructor(private readonly settingsPort: ContextSettingsPort) {
    this.updateUseCase = new UpdateAdoContextUseCase(this.settingsPort);
  }

  public async getActiveContext(): Promise<AdoContext | null> {
    return this.settingsPort.getContext();
  }

  public async setActiveContext(input: AdoContext): Promise<AdoContext> {
    return this.updateUseCase.execute(input);
  }
}
