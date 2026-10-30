import { test, expect } from "bun:test";
import sharp from "sharp";
import { cleanTenantImage } from "../src/api/lib/tenant-image";

test("portable codecs decode JPEG, PNG and both WebP variants, then strip metadata", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const source = sharp({ create: { width: 32, height: 20, channels: 3, background: "#12065c" } });
    const input = await source[format]().withMetadata().toBuffer();
    const output = await cleanTenantImage(input, "photo");
    const result = await sharp(output).metadata();
    expect(result.format).toBe("jpeg");
    expect(result.width).toBe(32);
    expect(result.height).toBe(20);
    expect(result.exif).toBeUndefined();
  }
  const lossless = await sharp({
    create: { width: 12, height: 16, channels: 3, background: "#12065c" },
  })
    .webp({ lossless: true })
    .toBuffer();
  expect((await sharp(await cleanTenantImage(lossless, "photo")).metadata()).width).toBe(12);
});

test("resize and EXIF orientation are preserved without copying identifying metadata", async () => {
  const input = await sharp({
    create: { width: 3000, height: 1000, channels: 3, background: "#dad7e8" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await sharp(await cleanTenantImage(input, "photo")).metadata();
  expect(result.width).toBe(800);
  expect(result.height).toBe(2400);
  expect(result.exif).toBeUndefined();
});

test("blank or invisible signatures, forged images and excessive dimensions are rejected", async () => {
  for (const background of ["#ffffff", { r: 0, g: 0, b: 0, alpha: 0 }]) {
    const blank = await sharp({ create: { width: 20, height: 20, channels: 4, background } })
      .png()
      .toBuffer();
    await expect(cleanTenantImage(blank, "signature")).rejects.toThrow("Empty signature");
  }
  await expect(cleanTenantImage(Buffer.from("oops"), "photo")).rejects.toThrow();
  const header = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
  header.writeUInt32BE(100000, 16);
  header.writeUInt32BE(100000, 20);
  await expect(cleanTenantImage(header, "photo")).rejects.toThrow("dimensions");
  const signature = await sharp(
    Buffer.from(
      '<svg width="100" height="40"><path d="M5 30 L30 5 L60 30 L90 5" stroke="black" stroke-width="2" fill="none"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  expect((await sharp(await cleanTenantImage(signature, "signature")).metadata()).format).toBe(
    "png",
  );
});
