import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AdoContextStore } from "../../../app/config/ado-context.store.js";
import { FileContextSettingsAdapter } from "./file-context-settings.adapter.js";

describe("FileContextSettingsAdapter", () => {
  it("persists and reloads context across store restarts", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ado-context-"));
    const filePath = path.join(root, "settings", "ado-context.json");

    const firstAdapter = new FileContextSettingsAdapter(filePath);
    const firstStore = new AdoContextStore(firstAdapter);

    const saved = await firstStore.setActiveContext({
      organization: "contoso",
      project: "delivery"
    });

    expect(saved).toEqual({ organization: "contoso", project: "delivery" });

    const secondAdapter = new FileContextSettingsAdapter(filePath);
    const secondStore = new AdoContextStore(secondAdapter);

    await expect(secondStore.getActiveContext()).resolves.toEqual({
      organization: "contoso",
      project: "delivery"
    });
  });

  it("returns null when no context file exists", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ado-context-empty-"));
    const filePath = path.join(root, "settings", "ado-context.json");
    const adapter = new FileContextSettingsAdapter(filePath);

    await expect(adapter.getContext()).resolves.toBeNull();
  });

  it("validates required values in use case", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ado-context-invalid-"));
    const filePath = path.join(root, "settings", "ado-context.json");
    const adapter = new FileContextSettingsAdapter(filePath);
    const store = new AdoContextStore(adapter);

    await expect(
      store.setActiveContext({ organization: "   ", project: "proj" })
    ).rejects.toThrow("organization is required");

    await expect(
      store.setActiveContext({ organization: "org", project: "   " })
    ).rejects.toThrow("project is required");
  });
});
