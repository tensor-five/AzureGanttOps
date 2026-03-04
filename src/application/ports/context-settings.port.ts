export type AdoContext = {
  organization: string;
  project: string;
};

export interface ContextSettingsPort {
  getContext(): Promise<AdoContext | null>;
  saveContext(context: AdoContext): Promise<void>;
}
