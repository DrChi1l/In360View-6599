import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import decodeWebp, { init as initWebp } from "@jsquash/webp/decode.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type Pixels = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
const MAX_PIXELS = 40_000_000;
let webpReady: Promise<void> | undefined;

function dimensions(width: number, height: number) {
  if (!width || !height || width * height > MAX_PIXELS)
    throw new Error("Image dimensions exceed limit");
}

async function prepareWebp() {
  // The decoder is a portable WASM asset, copied by Vite into dist/wasm.
  // No platform-specific .node binary or node_modules directory is needed.
  const cwd = "cwd" in process && typeof (process as { cwd?: () => string }).cwd === "function" ? (process as { cwd: () => string }).cwd() : "";
  const paths = [
    resolve(import.meta.dirname, "../dist/wasm/webp-decoder.wasm"),
    resolve(cwd, "dist/wasm/webp-decoder.wasm"),
    resolve(cwd, "public/wasm/webp-decoder.wasm"),
    resolve(cwd, "packages/web/public/wasm/webp-decoder.wasm"),
  ];
  for (const path of paths) {
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch {
      continue;
    }
    await initWebp({ wasmBinary: new Uint8Array(bytes) });
    return;
  }
  throw new Error("WebP decoder asset unavailable");
}

/** True when the bytes start like a WebP file ("RIFF" .... "WEBP"). */
export function isWebp(bytes: Uint8Array) {
  return (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  );
}

/** Decodes a WebP image and re-encodes it as JPEG: pdf-lib can only embed JPEG and PNG. */
export async function webpToJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  webpReady ??= prepareWebp().catch((error) => {
    webpReady = undefined;
    throw error;
  });
  await webpReady;
  const pixels = await decodeWebp(Uint8Array.from(bytes).buffer);
  dimensions(pixels.width, pixels.height);
  return jpeg.encode({ width: pixels.width, height: pixels.height, data: pixels.data }, 85).data;
}

function webpDimensions(bytes: Buffer) {
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + length > bytes.length) throw new Error("Truncated WebP");
    if (type === "VP8X" && length >= 10) {
      if (bytes[start] & 2) throw new Error("Animated WebP is not supported");
      return [1 + bytes.readUIntLE(start + 4, 3), 1 + bytes.readUIntLE(start + 7, 3)];
    }
    if (
      type === "VP8 " &&
      length >= 10 &&
      bytes.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 1, 0x2a]))
    )
      return [bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff];
    if (type === "VP8L" && length >= 5 && bytes[start] === 0x2f) {
      const bits = bytes.readUInt32LE(start + 1);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    offset = start + length + (length % 2);
  }
  throw new Error("Invalid WebP header");
}

// Read only the EXIF orientation; metadata is deliberately not copied to output.
function orientation(bytes: Buffer) {
  try {
    for (let offset = 2; offset + 4 < bytes.length; ) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if (marker === 0xe1 && bytes.toString("ascii", offset + 4, offset + 10) === "Exif\0\0") {
        const tiff = bytes.subarray(offset + 10, offset + 2 + length);
        const little = tiff.toString("ascii", 0, 2) === "II";
        const u16 = (o: number) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
        const u32 = (o: number) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
        if (u16(2) !== 42) break;
        const ifd = u32(4),
          count = u16(ifd);
        for (let n = 0; n < count; n++) {
          const pos = ifd + 2 + n * 12;
          if (u16(pos) === 0x112 && u16(pos + 2) === 3 && u32(pos + 4) === 1) {
            const value = u16(pos + 8);
            return value >= 1 && value <= 8 ? value : 1;
          }
        }
      }
      offset += 2 + length;
    }
  } catch {
    /* Malformed optional EXIF must not bypass actual image decoding. */
  }
  return 1;
}

function transform(image: Pixels, rotation: number, flatten: boolean): Pixels {
  const swap = rotation >= 5;
  const ow = swap ? image.height : image.width,
    oh = swap ? image.width : image.height;
  const scale = Math.min(1, 2400 / ow, 2400 / oh);
  const width = Math.max(1, Math.round(ow * scale)),
    height = Math.max(1, Math.round(oh * scale));
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const ox = Math.min(ow - 1, Math.max(0, ((x + 0.5) * ow) / width - 0.5));
      const oy = Math.min(oh - 1, Math.max(0, ((y + 0.5) * oh) / height - 0.5));
      let sx = ox,
        sy = oy;
      if (rotation === 2) sx = image.width - 1 - ox;
      if (rotation === 3) {
        sx = image.width - 1 - ox;
        sy = image.height - 1 - oy;
      }
      if (rotation === 4) sy = image.height - 1 - oy;
      if (rotation === 5) {
        sx = oy;
        sy = ox;
      }
      if (rotation === 6) {
        sx = oy;
        sy = image.height - 1 - ox;
      }
      if (rotation === 7) {
        sx = image.width - 1 - oy;
        sy = image.height - 1 - ox;
      }
      if (rotation === 8) {
        sx = image.width - 1 - oy;
        sy = ox;
      }
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy);
      const x1 = Math.min(image.width - 1, x0 + 1),
        y1 = Math.min(image.height - 1, y0 + 1);
      const fx = sx - x0,
        fy = sy - y0,
        out = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = image.data[(y0 * image.width + x0) * 4 + c];
        const b = image.data[(y0 * image.width + x1) * 4 + c];
        const d = image.data[(y1 * image.width + x0) * 4 + c];
        const e = image.data[(y1 * image.width + x1) * 4 + c];
        data[out + c] = Math.round(
          (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy,
        );
      }
      if (flatten) {
        const alpha = data[out + 3] / 255;
        for (let c = 0; c < 3; c++)
          data[out + c] = Math.round(data[out + c] * alpha + 255 * (1 - alpha));
        data[out + 3] = 255;
      }
    }
  return { width, height, data };
}

function hasSignatureInk(image: Pixels) {
  let sum = 0,
    squares = 0;
  const count = image.width * image.height;
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3] / 255;
    const brightness = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
    const visible = brightness * alpha + 255 * (1 - alpha);
    sum += visible;
    squares += visible * visible;
  }
  return Math.sqrt(Math.max(0, squares / count - (sum / count) ** 2)) >= 0.5;
}

/** Portable upload decoder/re-encoder: safe in the standalone Bun release bundle. */
export async function cleanTenantImage(bytes: Buffer, kind: "photo" | "signature") {
  let pixels: Pixels,
    rotation = 1;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (kind === "signature" && !png) throw new Error("Signature must be PNG");
  if (png) {
    dimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
    pixels = PNG.sync.read(bytes, { checkCRC: true });
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    pixels = jpeg.decode(bytes, {
      useTArray: true,
      maxResolutionInMP: 40,
      maxMemoryUsageInMB: 192,
      tolerantDecoding: false,
    });
    rotation = orientation(bytes);
  } else if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const [width, height] = webpDimensions(bytes);
    dimensions(width, height);
    webpReady ??= prepareWebp().catch((error) => {
      webpReady = undefined;
      throw error;
    });
    await webpReady;
    pixels = await decodeWebp(Uint8Array.from(bytes).buffer);
  } else throw new Error("Unsupported image");
  dimensions(pixels.width, pixels.height);
  if (pixels.data.length !== pixels.width * pixels.height * 4) throw new Error("Invalid pixels");
  if (kind === "signature" && !hasSignatureInk(pixels)) throw new Error("Empty signature");
  const output = transform(pixels, rotation, kind === "photo");
  if (kind === "signature") {
    const result = new PNG({ width: output.width, height: output.height });
    result.data = Buffer.from(output.data);
    return PNG.sync.write(result);
  }
  return Buffer.from(jpeg.encode(output, 85).data);
}
