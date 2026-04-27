import { describe, expect, it } from "vitest";

import { formatPrintTimestamp } from "./timeline-print-header.js";

describe("formatPrintTimestamp", () => {
  it("formats date and time with zero-padded fields", () => {
    expect(formatPrintTimestamp(new Date(2026, 0, 5, 7, 3))).toBe("2026-01-05 07:03");
  });

  it("uses 24-hour clock", () => {
    expect(formatPrintTimestamp(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31 23:59");
  });
});
