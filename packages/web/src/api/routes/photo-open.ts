import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { presignGet } from "../lib/s3";

/**
 * Plain HTTP route behind the photograph links embedded in report PDFs:
 * `/api/photos/:id/open` redirects to a freshly presigned storage URL for the
 * full-resolution image.
 *
 * It is deliberately unauthenticated — a PDF is read by landlords, tenants and
 * agents who may have no account, and often long after any presigned URL would
 * have expired. The photo id is a 64-bit random token, so the link is as
 * guessable as the presigned URLs the app already hands out.
 */
export async function photoOpen(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.text("Not found", 404);

  const [photo] = await db
    .select({ storageKey: schema.photos.storageKey, thumbKey: schema.photos.thumbKey })
    .from(schema.photos)
    .where(eq(schema.photos.id, id))
    .limit(1);

  if (!photo) return c.text("That photograph is no longer available.", 404);

  const url = await presignGet(photo.storageKey ?? photo.thumbKey, 60 * 60);
  return c.redirect(url, 302);
}
