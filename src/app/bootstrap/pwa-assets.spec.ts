import { describe, expect, it } from "vitest";

import {
  PWA_CACHE_ALLOWLIST,
  PWA_ICON_192_PATH,
  PWA_ICON_512_PATH,
  PWA_MANIFEST_PATH,
  PWA_THEME_COLOR
} from "./pwa-constants.js";
import {
  PWA_ICON_192_PNG_BUFFER,
  PWA_ICON_512_PNG_BUFFER,
  PWA_MANIFEST
} from "./pwa-assets.js";

describe("pwa-assets", () => {
  it("defines an installable same-origin manifest", () => {
    expect(PWA_MANIFEST).toMatchObject({
      name: "AzureGanttOps",
      short_name: "GanttOps",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: PWA_THEME_COLOR,
      background_color: "#ffffff"
    });
    expect(PWA_MANIFEST.icons).toEqual([
      {
        src: PWA_ICON_192_PATH,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: PWA_ICON_512_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]);
  });

  it("creates PNG icons with expected IHDR dimensions", () => {
    expect(readPngDimensions(PWA_ICON_192_PNG_BUFFER)).toEqual({ width: 192, height: 192 });
    expect(readPngDimensions(PWA_ICON_512_PNG_BUFFER)).toEqual({ width: 512, height: 512 });
  });

  it("keeps the service worker cache allowlist narrow", () => {
    expect(PWA_CACHE_ALLOWLIST).toEqual([PWA_MANIFEST_PATH, PWA_ICON_192_PATH, PWA_ICON_512_PATH]);
  });
});

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(buffer.subarray(12, 16).toString("ascii")).toBe("IHDR");

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}
