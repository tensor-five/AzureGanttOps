import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { FieldMappingProfile } from "../../../domain/mapping/field-mapping.js";
import { FileMappingSettingsAdapter } from "./file-mapping-settings.adapter.js";

function createProfile(id: string, name: string): FieldMappingProfile {
  return {
    id,
    name,
    fields: {
      id: "System.Id",
      title: "System.Title",
      start: "Microsoft.VSTS.Scheduling.StartDate",
      endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
    }
  };
}

describe("FileMappingSettingsAdapter", () => {
  // MAP-03: persisted mapping profiles survive restart and load deterministically.
  it("persists and reloads mapping profiles across restarts", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mapping-settings-"));
    const filePath = path.join(root, "settings", "mapping-settings.json");

    const firstAdapter = new FileMappingSettingsAdapter(filePath);
    const profiles = [createProfile("profile-a", "Default")];

    await firstAdapter.saveProfiles(profiles);
    await firstAdapter.setLastActiveProfileId("profile-a");

    const secondAdapter = new FileMappingSettingsAdapter(filePath);

    await expect(secondAdapter.loadProfiles()).resolves.toEqual(profiles);
    await expect(secondAdapter.getLastActiveProfileId()).resolves.toBe("profile-a");
  });

  it("returns deterministic defaults when settings file does not exist", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mapping-settings-empty-"));
    const filePath = path.join(root, "settings", "mapping-settings.json");
    const adapter = new FileMappingSettingsAdapter(filePath);

    await expect(adapter.loadProfiles()).resolves.toEqual([]);
    await expect(adapter.getLastActiveProfileId()).resolves.toBeNull();
  });

  // MAP-03: last-active profile resolution falls back cleanly when profile no longer exists.
  it("clears last active profile when saved profiles no longer contain it", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mapping-settings-fallback-"));
    const filePath = path.join(root, "settings", "mapping-settings.json");
    const adapter = new FileMappingSettingsAdapter(filePath);

    await adapter.saveProfiles([createProfile("profile-a", "A")]);
    await adapter.setLastActiveProfileId("profile-a");

    await adapter.saveProfiles([createProfile("profile-b", "B")]);

    await expect(adapter.getLastActiveProfileId()).resolves.toBeNull();
  });

  it("rejects malformed settings JSON with explicit error", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mapping-settings-invalid-json-"));
    const filePath = path.join(root, "settings", "mapping-settings.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "{not-valid-json", "utf8");

    const adapter = new FileMappingSettingsAdapter(filePath);

    await expect(adapter.loadProfiles()).rejects.toThrow("Mapping settings file is malformed JSON");
  });

  it("rejects invalid shape with explicit error", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mapping-settings-invalid-shape-"));
    const filePath = path.join(root, "settings", "mapping-settings.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ profiles: {}, lastActiveProfileId: null }), "utf8");

    const adapter = new FileMappingSettingsAdapter(filePath);

    await expect(adapter.loadProfiles()).rejects.toThrow("Mapping settings file has invalid shape");
  });

  it("rejects setting last active profile when profile is unknown", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mapping-settings-unknown-active-"));
    const filePath = path.join(root, "settings", "mapping-settings.json");
    const adapter = new FileMappingSettingsAdapter(filePath);

    await adapter.saveProfiles([createProfile("profile-a", "A")]);

    await expect(adapter.setLastActiveProfileId("profile-missing")).rejects.toThrow(
      "Mapping last active profile ID must reference an existing profile"
    );
  });
});
