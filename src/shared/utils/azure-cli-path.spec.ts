import { describe, expect, it } from "vitest";

import { normalizeConfiguredAzCliPath } from "./azure-cli-path.js";

describe("normalizeConfiguredAzCliPath", () => {
  it("accepts valid executable paths and trims whitespace", () => {
    expect(normalizeConfiguredAzCliPath("  az  ")).toBe("az");
    expect(normalizeConfiguredAzCliPath("C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd")).toBe(
      "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd"
    );
  });

  it("rejects empty, control-char and shell-meta candidates", () => {
    expect(normalizeConfiguredAzCliPath("   ")).toBeNull();
    expect(normalizeConfiguredAzCliPath("az\n--version")).toBeNull();
    expect(normalizeConfiguredAzCliPath("az; rm -rf /")).toBeNull();
    expect(normalizeConfiguredAzCliPath("az|cat")).toBeNull();
    expect(normalizeConfiguredAzCliPath("`az`")).toBeNull();
  });

  it("rejects excessively long values", () => {
    const longValue = "a".repeat(1025);
    expect(normalizeConfiguredAzCliPath(longValue)).toBeNull();
  });
});

