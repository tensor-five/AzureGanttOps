import { describe, expect, it } from "vitest";

import { sanitizeHtmlFragment } from "./sanitize-html-fragment.js";

describe("sanitizeHtmlFragment", () => {
  it("removes script tags and event handler attributes", () => {
    const sanitized = sanitizeHtmlFragment('<p onclick="evil()">Alpha</p><script>alert(1)</script>');

    expect(sanitized).toBe("<p>Alpha</p>");
  });

  it("keeps allowed anchors and strips javascript href", () => {
    const safe = sanitizeHtmlFragment('<a href="https://example.com" target="_blank">ok</a>');
    const unsafe = sanitizeHtmlFragment('<a href="javascript:alert(1)">bad</a>');

    expect(safe).toBe('<a href="https://example.com">ok</a>');
    expect(unsafe).toBe("<a>bad</a>");
  });
});
