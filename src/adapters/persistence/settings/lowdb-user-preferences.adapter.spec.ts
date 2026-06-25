import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LowdbUserPreferencesAdapter } from "./lowdb-user-preferences.adapter.js";

describe("LowdbUserPreferencesAdapter", () => {
  it("deletes only the current user's preferences", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lowdb-user-preferences-"));
    const filePath = path.join(root, "user-preferences.json");
    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        users: {
          "current-user": {
            themeMode: "dark"
          },
          "other-user": {
            themeMode: "light"
          }
        }
      }),
      "utf8"
    );
    const adapter = new LowdbUserPreferencesAdapter(filePath, "current-user");

    await expect(adapter.deleteCurrentUserPreferences()).resolves.toBe(true);

    const persisted = JSON.parse(await fs.readFile(filePath, "utf8")) as {
      users: Record<string, unknown>;
    };
    expect(persisted.users["current-user"]).toBeUndefined();
    expect(persisted.users["other-user"]).toEqual({
      themeMode: "light"
    });
  });

  it("skips when the preferences file or current user entry is absent", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lowdb-user-preferences-empty-"));
    const filePath = path.join(root, "user-preferences.json");
    const adapter = new LowdbUserPreferencesAdapter(filePath, "current-user");

    await expect(adapter.deleteCurrentUserPreferences()).resolves.toBe(false);

    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        users: {
          "other-user": {
            themeMode: "light"
          }
        }
      }),
      "utf8"
    );

    await expect(adapter.deleteCurrentUserPreferences()).resolves.toBe(false);
  });
});
