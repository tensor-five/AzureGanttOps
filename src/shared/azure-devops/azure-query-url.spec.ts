import { describe, expect, it } from "vitest";

import { buildAzureQueryUrl } from "./azure-query-url.js";

describe("buildAzureQueryUrl", () => {
  it("composes the canonical Azure DevOps query URL", () => {
    expect(buildAzureQueryUrl("contoso", "delivery", "abc-123")).toBe(
      "https://dev.azure.com/contoso/delivery/_queries/query/abc-123"
    );
  });

  it("returns null when any input is missing or whitespace-only", () => {
    expect(buildAzureQueryUrl(null, "p", "q")).toBeNull();
    expect(buildAzureQueryUrl("o", undefined, "q")).toBeNull();
    expect(buildAzureQueryUrl("o", "p", "")).toBeNull();
    expect(buildAzureQueryUrl("o", "p", "   ")).toBeNull();
  });

  it("trims whitespace around inputs", () => {
    expect(buildAzureQueryUrl("  contoso  ", "  delivery  ", "  abc  ")).toBe(
      "https://dev.azure.com/contoso/delivery/_queries/query/abc"
    );
  });

  it("URL-encodes path segments", () => {
    expect(buildAzureQueryUrl("My Org", "Project A", "id with spaces")).toBe(
      "https://dev.azure.com/My%20Org/Project%20A/_queries/query/id%20with%20spaces"
    );
  });
});
