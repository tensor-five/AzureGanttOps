import { promises as fs } from "node:fs";
import path from "node:path";

import type { MappingSettingsPort } from "../../../application/ports/mapping-settings.port.js";
import type { FieldMappingProfile, RequiredFieldMappings } from "../../../domain/mapping/field-mapping.js";

type PersistedMappingSettings = {
  profiles: PersistedMappingProfile[];
  lastActiveProfileId: string | null;
};

type PersistedMappingProfile = {
  id: string;
  name: string;
  fields: RequiredFieldMappings;
};

export class FileMappingSettingsAdapter implements MappingSettingsPort {
  public constructor(private readonly filePath: string) {}

  public async loadProfiles(): Promise<FieldMappingProfile[]> {
    const settings = await this.readSettings();
    return settings.profiles;
  }

  public async saveProfiles(profiles: FieldMappingProfile[]): Promise<void> {
    const settings = await this.readSettingsOrDefault();
    const normalizedProfiles = profiles.map(normalizeProfile);

    const lastActiveProfileId =
      settings.lastActiveProfileId && normalizedProfiles.some((profile) => profile.id === settings.lastActiveProfileId)
        ? settings.lastActiveProfileId
        : null;

    await this.writeSettings({
      profiles: normalizedProfiles,
      lastActiveProfileId
    });
  }

  public async getLastActiveProfileId(): Promise<string | null> {
    const settings = await this.readSettings();

    if (!settings.lastActiveProfileId) {
      return null;
    }

    return settings.profiles.some((profile) => profile.id === settings.lastActiveProfileId)
      ? settings.lastActiveProfileId
      : null;
  }

  public async setLastActiveProfileId(profileId: string | null): Promise<void> {
    const settings = await this.readSettingsOrDefault();

    if (profileId === null) {
      await this.writeSettings({
        profiles: settings.profiles,
        lastActiveProfileId: null
      });
      return;
    }

    const normalizedProfileId = profileId.trim();

    if (!normalizedProfileId) {
      throw new Error("Mapping last active profile ID cannot be blank");
    }

    if (!settings.profiles.some((profile) => profile.id === normalizedProfileId)) {
      throw new Error("Mapping last active profile ID must reference an existing profile");
    }

    await this.writeSettings({
      profiles: settings.profiles,
      lastActiveProfileId: normalizedProfileId
    });
  }

  private async readSettingsOrDefault(): Promise<PersistedMappingSettings> {
    try {
      return await this.readSettings();
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Mapping settings file is malformed JSON") {
        throw error;
      }

      if (error instanceof Error && error.message === "Mapping settings file has invalid shape") {
        throw error;
      }

      return {
        profiles: [],
        lastActiveProfileId: null
      };
    }
  }

  private async readSettings(): Promise<PersistedMappingSettings> {
    let raw: string;

    try {
      raw = await fs.readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return {
          profiles: [],
          lastActiveProfileId: null
        };
      }

      throw new Error("Failed to read mapping settings");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Mapping settings file is malformed JSON");
    }

    if (!isPersistedMappingSettings(parsed)) {
      throw new Error("Mapping settings file has invalid shape");
    }

    const profiles = parsed.profiles.map((profile) => normalizeProfile(profile));

    return {
      profiles,
      lastActiveProfileId: parsed.lastActiveProfileId
    };
  }

  private async writeSettings(settings: PersistedMappingSettings): Promise<void> {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });

    const payload: PersistedMappingSettings = {
      profiles: settings.profiles.map((profile) => normalizeProfile(profile)),
      lastActiveProfileId: settings.lastActiveProfileId
    };

    await fs.writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}

function normalizeProfile(profile: PersistedMappingProfile): PersistedMappingProfile {
  return {
    id: profile.id.trim(),
    name: profile.name.trim(),
    fields: {
      id: profile.fields.id.trim(),
      title: profile.fields.title.trim(),
      start: profile.fields.start.trim(),
      endOrTarget: profile.fields.endOrTarget.trim()
    }
  };
}

function isPersistedMappingProfile(value: unknown): value is PersistedMappingProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
    return false;
  }

  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    return false;
  }

  if (!candidate.fields || typeof candidate.fields !== "object") {
    return false;
  }

  const fields = candidate.fields as Record<string, unknown>;

  return (
    typeof fields.id === "string" &&
    fields.id.trim().length > 0 &&
    typeof fields.title === "string" &&
    fields.title.trim().length > 0 &&
    typeof fields.start === "string" &&
    fields.start.trim().length > 0 &&
    typeof fields.endOrTarget === "string" &&
    fields.endOrTarget.trim().length > 0
  );
}

function isPersistedMappingSettings(value: unknown): value is PersistedMappingSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (!Array.isArray(candidate.profiles)) {
    return false;
  }

  if (!(typeof candidate.lastActiveProfileId === "string" || candidate.lastActiveProfileId === null)) {
    return false;
  }

  return candidate.profiles.every((profile) => isPersistedMappingProfile(profile));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error !== null && typeof error === "object" && "code" in error;
}
