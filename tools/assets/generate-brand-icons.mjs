import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const sourcePath = resolve(root, "assets", "brand", "jarvis-app-icon.svg");
const outputPath = resolve(root, "apps", "desktop", "src-tauri", "icons", "icon.ico");
const outputSizes = [16, 24, 32, 48, 64, 256];
const supersample = 4;

const source = readFileSync(sourcePath, "utf8");

function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

function number(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`canonical app-icon attribute ${name} is not numeric`);
  }
  return parsed;
}

function color(value, name) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    throw new Error(`canonical app-icon ${name} must be a six-digit hex color`);
  }
  return [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)];
}

function parseCanonicalIcon(svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    throw new Error("canonical app-icon must provide a numeric viewBox");
  }

  const elements = [...svg.matchAll(/<(rect|circle)\b([^>]*)\/?\s*>/g)].map((match) => ({
    kind: match[1],
    attributes: attributes(match[2]),
  }));
  const rect = elements.find(({ kind }) => kind === "rect");
  const circles = elements.filter(({ kind }) => kind === "circle");
  if (!rect || circles.length !== 2) {
    throw new Error("canonical app-icon must contain one background rect and two circles");
  }

  const background = rect.attributes;
  const ring = circles.find(({ attributes: values }) => values.stroke);
  const core = circles.find(({ attributes: values }) => values.fill === "#FFFFFF");
  if (!ring || !core) {
    throw new Error("canonical app-icon must contain a stroked ring and white core");
  }

  const brand = {
    slate: color(background.fill, "background fill"),
    blue: color(ring.attributes.stroke, "ring stroke"),
    white: color(core.attributes.fill, "core fill"),
  };
  const allowed = new Set([background.fill.toUpperCase(), ring.attributes.stroke.toUpperCase(), core.attributes.fill.toUpperCase()]);
  const colors = [...svg.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)].map((match) => match[1].toUpperCase());
  if (colors.some((value) => !allowed.has(value))) {
    throw new Error("canonical app-icon contains a color outside the approved brand palette");
  }

  const dashArray = ring.attributes["stroke-dasharray"]?.split(/\s+/).map(Number);
  if (!dashArray || dashArray.length === 0 || dashArray.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("canonical app-icon ring must provide a positive stroke dash array");
  }
  const rotation = number(ring.attributes.transform?.match(/rotate\((-?[0-9.]+)/)?.[1] ?? "0", "ring rotation");

  return {
    viewBox: { x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3] },
    background: {
      x: number(background.x, "background x"),
      y: number(background.y, "background y"),
      width: number(background.width, "background width"),
      height: number(background.height, "background height"),
      radius: number(background.rx, "background radius"),
    },
    ring: {
      centerX: number(ring.attributes.cx, "ring cx"),
      centerY: number(ring.attributes.cy, "ring cy"),
      radius: number(ring.attributes.r, "ring radius"),
      stroke: number(ring.attributes["stroke-width"], "ring stroke width"),
      dashArray,
      rotation,
    },
    core: {
      centerX: number(core.attributes.cx, "core cx"),
      centerY: number(core.attributes.cy, "core cy"),
      radius: number(core.attributes.r, "core radius"),
    },
    brand,
  };
}

function roundedRectangleContains(x, y, rectangle) {
  const left = rectangle.x;
  const right = rectangle.x + rectangle.width;
  const top = rectangle.y;
  const bottom = rectangle.y + rectangle.height;
  const radius = Math.min(rectangle.radius, rectangle.width / 2, rectangle.height / 2);
  if (x < left || x > right || y < top || y > bottom) return false;
  if (x >= left + radius && x <= right - radius) return true;
  if (y >= top + radius && y <= bottom - radius) return true;
  const cornerX = x < left + radius ? left + radius : right - radius;
  const cornerY = y < top + radius ? top + radius : bottom - radius;
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 <= radius ** 2;
}

function ringContains(x, y, ring) {
  const radians = (ring.rotation * Math.PI) / 180;
  const translatedX = x - ring.centerX;
  const translatedY = y - ring.centerY;
  const unrotatedX = translatedX * Math.cos(radians) + translatedY * Math.sin(radians);
  const unrotatedY = -translatedX * Math.sin(radians) + translatedY * Math.cos(radians);
  const distance = Math.hypot(unrotatedX, unrotatedY);
  if (Math.abs(distance - ring.radius) > ring.stroke / 2) return false;

  let angle = Math.atan2(unrotatedY, unrotatedX);
  if (angle < 0) angle += 2 * Math.PI;
  const circumference = 2 * Math.PI * ring.radius;
  const position = (angle / (2 * Math.PI)) * circumference;
  const patternLength = ring.dashArray.reduce((sum, value) => sum + value, 0);
  let cursor = position % patternLength;
  for (let index = 0; index < ring.dashArray.length; index += 1) {
    if (cursor < ring.dashArray[index]) return index % 2 === 0;
    cursor -= ring.dashArray[index];
  }
  return false;
}

function circleContains(x, y, circle) {
  return (x - circle.centerX) ** 2 + (y - circle.centerY) ** 2 <= circle.radius ** 2;
}

function renderPng(icon, size) {
  const scale = supersample;
  const sampleSize = size * scale;
  const pixels = Buffer.alloc(size * size * 4);
  const samplesPerPixel = scale * scale;

  for (let outputY = 0; outputY < size; outputY += 1) {
    for (let outputX = 0; outputX < size; outputX += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let sampleY = 0; sampleY < scale; sampleY += 1) {
        for (let sampleX = 0; sampleX < scale; sampleX += 1) {
          const x = (outputX * scale + sampleX + 0.5) * (icon.viewBox.width / sampleSize) + icon.viewBox.x;
          const y = (outputY * scale + sampleY + 0.5) * (icon.viewBox.height / sampleSize) + icon.viewBox.y;
          let sample = null;
          if (roundedRectangleContains(x, y, icon.background)) sample = [...icon.brand.slate, 255];
          if (ringContains(x, y, icon.ring)) sample = [...icon.brand.blue, 255];
          if (circleContains(x, y, icon.core)) sample = [...icon.brand.white, 255];
          if (sample) {
            red += sample[0];
            green += sample[1];
            blue += sample[2];
            alpha += sample[3];
          }
        }
      }
      const offset = (outputY * size + outputX) * 4;
      pixels[offset] = Math.round(red / samplesPerPixel);
      pixels[offset + 1] = Math.round(green / samplesPerPixel);
      pixels[offset + 2] = Math.round(blue / samplesPerPixel);
      pixels[offset + 3] = Math.round(alpha / samplesPerPixel);
    }
  }

  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    rows[y * (size * 4 + 1)] = 0;
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return png(size, rows);
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return result;
}

function png(size, scanlines) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ico(layers) {
  const directory = Buffer.alloc(6 + layers.length * 16);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(layers.length, 4);
  let offset = directory.length;
  layers.forEach(({ size, payload }, index) => {
    const entry = 6 + index * 16;
    directory[entry] = size === 256 ? 0 : size;
    directory[entry + 1] = size === 256 ? 0 : size;
    directory[entry + 2] = 0;
    directory[entry + 3] = 0;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(payload.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += payload.length;
  });
  return Buffer.concat([directory, ...layers.map(({ payload }) => payload)]);
}

const icon = parseCanonicalIcon(source);
const layers = outputSizes.map((size) => ({ size, payload: renderPng(icon, size) }));
const output = ico(layers);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output);
console.log(`[brand-icons] source=${sourcePath}`);
console.log(`[brand-icons] output=${outputPath} bytes=${output.length} sha256=${createHash("sha256").update(output).digest("hex")}`);
console.log(`[brand-icons] layers=${outputSizes.join(",")}`);
