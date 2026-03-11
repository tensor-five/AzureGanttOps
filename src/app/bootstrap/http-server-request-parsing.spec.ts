import { describe, expect, it } from "vitest";

import { parseUpdateDetailsPayload } from "./http-server-request-parsing.js";

describe("parseUpdateDetailsPayload", () => {
  it("sanitizes description html", () => {
    const parsed = parseUpdateDetailsPayload({
      targetWorkItemId: 11,
      title: "Item",
      descriptionHtml: '<p onclick="evil()">Alpha</p><script>alert(1)</script>',
      state: "Active"
    });

    expect(parsed).toEqual({
      targetWorkItemId: 11,
      title: "Item",
      descriptionHtml: "<p>Alpha</p>",
      state: "Active"
    });
  });
});
