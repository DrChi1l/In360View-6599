/**
 * Client-side image preparation. Every inspection photo is downscaled and
 * re-encoded before it leaves the device: a full-size JPEG for the report and a
 * small square-ish thumbnail for the grids. An inspection can hold 700+ photos,
 * so the browser must never hold originals in memory longer than one file.
 *
 * Decoding a 12 MP JPEG and re-encoding it twice takes long enough to freeze
 * scrolling and button taps, so the work is handed to a small pool of workers
 * (see ./image-worker.ts) and several photos are compressed at once. Browsers
 * without OffscreenCanvas fall back to the original main-thread path.
 */

import type { PrepareRequest, PrepareResponse } from "./image-worker";

const FULL_MAX_EDGE = 1800;
const THUMB_MAX_EDGE = 420;
const FULL_QUALITY = 0.82;
const THUMB_QUALITY = 0.7;

export type PreparedImage = {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
};

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/* ---------------------------------------------------------------- main thread */

async function decode(file: Blob): Promise<{ source: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("The image could not be read."));
      el.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function render(
  source: CanvasImageSource,
  size: { width: number; height: number },
  quality: number,
): Promise<{ canvas: HTMLCanvasElement; blob: Blob }> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ canvas, blob }) : reject(new Error("The image could not be compressed."))),
      "image/jpeg",
      quality,
    );
  });
}

async function prepareOnMainThread(file: Blob): Promise<PreparedImage> {
  const { source, width, height } = await decode(file);
  const fullSize = fit(width, height, FULL_MAX_EDGE);
  const full = await render(source, fullSize, FULL_QUALITY);
  if ("close" in source && typeof source.close === "function") source.close();
  // The thumbnail is resampled from the downscaled canvas, not the original.
  const thumbSize = fit(fullSize.width, fullSize.height, THUMB_MAX_EDGE);
  const thumb = await render(full.canvas, thumbSize, THUMB_QUALITY);
  return { full: full.blob, thumb: thumb.blob, width: fullSize.width, height: fullSize.height };
}

/* -------------------------------------------------------------- worker pool */

type Job = {
  request: Omit<PrepareRequest, "id">;
  resolve: (value: PreparedImage) => void;
  reject: (error: Error) => void;
};

type Slot = { worker: Worker; job: (Job & { id: number }) | null };

/** Compression runs in parallel with the network, so a couple of cores is plenty. */
function poolSize() {
  const cores = typeof navigator === "undefined" ? 0 : (navigator.hardwareConcurrency ?? 0);
  return Math.max(2, Math.min(4, cores ? cores - 1 : 2));
}

function workersSupported() {
  return (
    typeof Worker === "function" &&
    typeof OffscreenCanvas === "function" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function"
  );
}

let slots: Slot[] | null = null;
let poolBroken = false;
let nextJobId = 1;
const waiting: Job[] = [];

function settle(slot: Slot, response: PrepareResponse) {
  const job = slot.job;
  slot.job = null;
  if (job && job.id === response.id) {
    if (response.ok) {
      job.resolve({ full: response.full, thumb: response.thumb, width: response.width, height: response.height });
    } else {
      job.reject(new Error(response.error));
    }
  }
  pump();
}

function spawn(): Slot {
  const worker = new Worker(new URL("./image-worker.ts", import.meta.url), { type: "module" });
  const slot: Slot = { worker, job: null };
  worker.onmessage = (event: MessageEvent<PrepareResponse>) => settle(slot, event.data);
  worker.onerror = () => {
    // A worker that cannot even load means the pool is unusable — fail this job
    // back to the caller, which retries on the main thread.
    poolBroken = true;
    const job = slot.job;
    slot.job = null;
    job?.reject(new Error("The image worker could not start."));
  };
  return slot;
}

function pump() {
  if (!slots) return;
  for (const slot of slots) {
    if (slot.job) continue;
    const job = waiting.shift();
    if (!job) return;
    const id = nextJobId++;
    slot.job = { ...job, id };
    slot.worker.postMessage({ ...job.request, id } satisfies PrepareRequest);
  }
}

function prepareInWorker(file: Blob): Promise<PreparedImage> {
  if (!slots) slots = Array.from({ length: poolSize() }, spawn);
  return new Promise<PreparedImage>((resolve, reject) => {
    waiting.push({
      request: {
        file,
        fullMaxEdge: FULL_MAX_EDGE,
        thumbMaxEdge: THUMB_MAX_EDGE,
        fullQuality: FULL_QUALITY,
        thumbQuality: THUMB_QUALITY,
      },
      resolve,
      reject,
    });
    pump();
  });
}

/**
 * Compresses one captured file into a full-size JPEG and a thumbnail. Safe to
 * call for many files at once: the worker pool bounds how many decode at a time
 * so memory stays flat even on a 700-photo inspection.
 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  if (!poolBroken && workersSupported()) {
    try {
      return await prepareInWorker(file);
    } catch (error) {
      if (!poolBroken) throw error instanceof Error ? error : new Error("The image could not be compressed.");
      // Worker died on load — fall through to the main thread for good.
    }
  }
  return prepareOnMainThread(file);
}
