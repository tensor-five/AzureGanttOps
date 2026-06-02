import { describe, expect, it } from "vitest";

import { buildAzureWorkItemUrl } from "./azure-work-item-url.js";

describe("buildAzureWorkItemUrl", () => {
  it("composes the canonical Azure DevOps work item URL", () => {
    expect(buildAzureWorkItemUrl("contoso", "delivery", 42)).toBe(
      "https://dev.azure.com/contoso/delivery/_workitems/edit/42"
    );
  });

  it("returns null when organization, project, or work item id is invalid", () => {
    expect(buildAzureWorkItemUrl(null, "delivery", 42)).toBeNull();
    expect(buildAzureWorkItemUrl("contoso", undefined, 42)).toBeNull();
    expect(buildAzureWorkItemUrl("contoso", "delivery", null)).toBeNull();
    expect(buildAzureWorkItemUrl("contoso", "delivery", 0)).toBeNull();
  });

  it("trims and URL-encodes path segments", () => {
    expect(buildAzureWorkItemUrl("  My Org  ", "  Project A  ", 7)).toBe(
      "https://dev.azure.com/My%20Org/Project%20A/_workitems/edit/7"
    );
  });
});
