import type { FieldMappingProfile } from "../../domain/mapping/field-mapping.js";

export interface MappingSettingsPort {
  loadProfiles(): Promise<FieldMappingProfile[]>;
  saveProfiles(profiles: FieldMappingProfile[]): Promise<void>;
  getLastActiveProfileId(): Promise<string | null>;
  setLastActiveProfileId(profileId: string | null): Promise<void>;
}
