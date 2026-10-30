/// <reference lib="webworker" />

/**
 * Image compression, off the UI thread.
 *
 * A clerk photographing a property fires files in bursts, and decoding a 12 MP
 * JPEG plus re-encoding it twice takes long enough to freeze scrolling and
 * button taps if it happens on the main thread. This worker does that work on
 * an OffscreenCanvas instead, and the thumbnail is rendered from the already
 * downscaled full-size bitmap rather than the original — a fraction of the
 * pixels to resample.
 */

export type PrepareRequest = {
  id: number;
  file: Blob;
  fullMaxEdge: number;
  thumbMaxEdge: number;
  fullQuality: number;
  thumbQuality: number;
};

export type PrepareResponse =
  | { id: number; ok: true; full: Blob; thumb: Blob; width: number; height: number }
  | { id: number; ok: false; error: string };

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function draw(source: ImageBitmap | OffscreenCanvas, size: { width: number; height: number }, quality: number) {
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size.width, size.height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return { canvas, blob };
}

self.onmessage = async (event: MessageEvent<PrepareRequest>) => {
  const req = event.data;
  try {
    const bitmap = await createImageBitmap(req.file);
    const fullSize = fit(bitmap.width, bitmap.height, req.fullMaxEdge);
    const full = await draw(bitmap, fullSize, req.fullQuality);
    bitmap.close();

    // Resample the thumbnail from the full-size canvas, not the original.
    const thumbSize = fit(fullSize.width, fullSize.height, req.thumbMaxEdge);
    const thumb = await draw(full.canvas, thumbSize, req.thumbQuality);

    const response: PrepareResponse = {
      id: req.id,
      ok: true,
      full: full.blob,
      thumb: thumb.blob,
      width: fullSize.width,
      height: fullSize.height,
    };
    self.postMessage(response);
  } catch (error) {
    const response: PrepareResponse = {
      id: req.id,
      ok: false,
      error: error instanceof Error ? error.message : "The image could not be compressed.",
    };
    self.postMessage(response);
  }
};
