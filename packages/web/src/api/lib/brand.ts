import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * PDF logos, read off disk once and cached. The files live in `public/images`
 * during development and are copied into `dist/images` by the build, so both
 * roots are tried.
 */
const cache = new Map<string, Uint8Array | null>();

async function loadImage(file: string): Promise<Uint8Array | null> {
  if (cache.has(file)) return cache.get(file) ?? null;
  const candidates = [
    `public/images/${file}`,
    `dist/images/${file}`,
    `../public/images/${file}`,
    `../dist/images/${file}`,
  ];
  const cwd = "cwd" in process && typeof (process as { cwd?: () => string }).cwd === "function" ? (process as { cwd: () => string }).cwd() : "";
  const roots = [cwd, path.resolve(import.meta.dirname, "../../..")].filter(Boolean);
  for (const root of roots) {
    for (const candidate of candidates) {
      try {
        const bytes = new Uint8Array(await readFile(path.resolve(root, candidate)));
        cache.set(file, bytes);
        return bytes;
      } catch {
        // Try the next candidate.
      }
    }
  }
  cache.set(file, null);
  return null;
}

/** Indigo wordmark, for white page headers. */
export const loadLogoBytes = () => loadImage("logo-wordmark.png");

/** White wordmark, for the dark band on the cover. */
export const loadLogoLightBytes = () => loadImage("logo-wordmark-light.png");
