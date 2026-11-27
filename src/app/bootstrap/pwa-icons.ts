import { deflateSync } from "node:zlib";

import {
  PWA_BACKGROUND_COLOR,
  PWA_SECONDARY_COLOR,
  PWA_THEME_COLOR
} from "./pwa-constants.js";

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IHDR_CHUNK_TYPE = "IHDR";
const PNG_IDAT_CHUNK_TYPE = "IDAT";
const PNG_IEND_CHUNK_TYPE = "IEND";
const PNG_COLOR_TYPE_TRUECOLOR_ALPHA = 6;
const PNG_BIT_DEPTH = 8;
const PNG_FILTER_NONE = 0;
const PNG_COMPRESSION_METHOD = 0;
const PNG_FILTER_METHOD = 0;
const PNG_INTERLACE_NONE = 0;
const PRIMARY_RGBA = hexToRgba(PWA_THEME_COLOR);
const SECONDARY_RGBA = hexToRgba(PWA_SECONDARY_COLOR);
const BACKGROUND_RGBA = hexToRgba(PWA_BACKGROUND_COLOR);
const GRID_RGBA = blendRgba(PRIMARY_RGBA, BACKGROUND_RGBA, 0.78);

function createPwaIconPng(size: number): Buffer {
  const rowLength = 1 + size * 4;
  const raw = Buffer.alloc(rowLength * size);
  const canvas = {
    left: size * 0.08,
    top: size * 0.08,
    right: size * 0.92,
    bottom: size * 0.92,
    radius: size * 0.18
  };
  const bars = [
    { left: 0.2, top: 0.25, right: 0.58, bottom: 0.34 },
    { left: 0.36, top: 0.43, right: 0.8, bottom: 0.52 },
    { left: 0.22, top: 0.61, right: 0.56, bottom: 0.7 },
    { left: 0.48, top: 0.73, right: 0.78, bottom: 0.82 }
  ];

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * rowLength;
    raw[rowOffset] = PNG_FILTER_NONE;

    for (let x = 0; x < size; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      const pixel = selectIconPixel(x + 0.5, y + 0.5, size, canvas, bars);
      raw[offset] = pixel[0];
      raw[offset + 1] = pixel[1];
      raw[offset + 2] = pixel[2];
      raw[offset + 3] = pixel[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = PNG_BIT_DEPTH;
  ihdr[9] = PNG_COLOR_TYPE_TRUECOLOR_ALPHA;
  ihdr[10] = PNG_COMPRESSION_METHOD;
  ihdr[11] = PNG_FILTER_METHOD;
  ihdr[12] = PNG_INTERLACE_NONE;

  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk(PNG_IHDR_CHUNK_TYPE, ihdr),
    createPngChunk(PNG_IDAT_CHUNK_TYPE, deflateSync(raw)),
    createPngChunk(PNG_IEND_CHUNK_TYPE, Buffer.alloc(0))
  ]);
}

function selectIconPixel(
  x: number,
  y: number,
  size: number,
  canvas: { left: number; top: number; right: number; bottom: number; radius: number },
  bars: ReadonlyArray<{ left: number; top: number; right: number; bottom: number }>
): Rgba {
  if (!isInRoundedRect(x, y, canvas.left, canvas.top, canvas.right, canvas.bottom, canvas.radius)) {
    return BACKGROUND_RGBA;
  }

  const gridSpacing = size * 0.17;
  const gridInset = size * 0.16;
  if (
    Math.abs(((x - gridInset) % gridSpacing) - gridSpacing) < 1 ||
    Math.abs((y - gridInset) % gridSpacing) < 1
  ) {
    return GRID_RGBA;
  }

  for (const bar of bars) {
    if (
      isInRoundedRect(
        x,
        y,
        size * bar.left,
        size * bar.top,
        size * bar.right,
        size * bar.bottom,
        size * 0.045
      )
    ) {
      return SECONDARY_RGBA;
    }
  }

  return PRIMARY_RGBA;
}

function isInRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number
): boolean {
  if (x < left || x > right || y < top || y > bottom) {
    return false;
  }

  const clampedX = Math.min(Math.max(x, left + radius), right - radius);
  const clampedY = Math.min(Math.max(y, top + radius), bottom - radius);
  const dx = x - clampedX;
  const dy = y - clampedY;
  return dx * dx + dy * dy <= radius * radius;
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function hexToRgba(hex: string): Rgba {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255
  ];
}

function blendRgba(foreground: Rgba, background: Rgba, alpha: number): Rgba {
  return [
    Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
    Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
    Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
    255
  ];
}

const CRC32_TABLE = createCrc32Table();

export const PWA_ICON_192_PNG_BUFFER = createPwaIconPng(192);
export const PWA_ICON_512_PNG_BUFFER = createPwaIconPng(512);

function createCrc32Table(): readonly number[] {
  const table: number[] = [];

  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[index] = crc >>> 0;
  }

  return table;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
