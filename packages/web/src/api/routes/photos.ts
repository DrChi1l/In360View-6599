import { ORPCError } from "@orpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { newId } from "../lib/ids";
import { deleteObject, presignGet, presignPut } from "../lib/s3";
import { authed } from "../middleware/auth";
import { assertEditable, loadReport } from "./reports";

export const photos = {
  /**
   * Step 1 of an upload: the client asks for presigned PUT URLs and uploads
   * straight to storage — bytes never pass through the API. Both the
   * full-size and thumbnail keys are issued at once so the client can compress
   * locally and upload both in parallel.
   */
  presign: authed
    .input(
      z.object({
        reportId: z.string(),
        count: z.number().int().min(1).max(20).default(1),
        contentType: z.string().default("image/jpeg"),
      }),
    )
    .handler(async ({ input, context }) => {
      const report = await loadReport(input.reportId, context.user.id, context.user.role);
      assertEditable(report);
      const ext = input.contentType === "image/png" ? "png" : "jpg";
      return Promise.all(
        Array.from({ length: input.count }, async () => {
          const base = `properties/${report.propertyId}/reports/${report.id}/${newId("ph")}`;
          const storageKey = `${base}.${ext}`;
          const thumbKey = `${base}_thumb.${ext}`;
          return {
            storageKey,
            thumbKey,
            uploadUrl: await presignPut(storageKey, input.contentType),
            thumbUploadUrl: await presignPut(thumbKey, input.contentType),
          };
        }),
      );
    }),

  /** Step 2: record the uploaded photo against report/room/item. Idempotent on clientId. */
  register: authed
    .input(
      z.object({
        reportId: z.string(),
        roomId: z.string().optional().nullable(),
        itemId: z.string().optional().nullable(),
        storageKey: z.string(),
        thumbKey: z.string().optional().nullable(),
        contentType: z.string().default("image/jpeg"),
        width: z.number().int().optional().nullable(),
        height: z.number().int().optional().nullable(),
        size: z.number().int().optional().nullable(),
        caption: z.string().max(300).optional().nullable(),
        clientId: z.string().max(80).optional().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const report = await loadReport(input.reportId, context.user.id, context.user.role);
      assertEditable(report);

      if (input.clientId) {
        const [existing] = await db
          .select()
          .from(schema.photos)
          .where(and(eq(schema.photos.reportId, report.id), eq(schema.photos.clientId, input.clientId)));
        if (existing) return { ...existing, thumbUrl: await presignGet(existing.thumbKey ?? existing.storageKey) };
      }

      const scope = input.itemId
        ? eq(schema.photos.itemId, input.itemId)
        : input.roomId
          ? and(eq(schema.photos.roomId, input.roomId), isNull(schema.photos.itemId))
          : eq(schema.photos.reportId, report.id);
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${schema.photos.sortOrder}), -1)` })
        .from(schema.photos)
        .where(scope);

      const id = newId("pho");
      await db.insert(schema.photos).values({
        id,
        propertyId: report.propertyId,
        reportId: report.id,
        roomId: input.roomId ?? null,
        itemId: input.itemId ?? null,
        storageKey: input.storageKey,
        thumbKey: input.thumbKey ?? null,
        contentType: input.contentType,
        width: input.width ?? null,
        height: input.height ?? null,
        size: input.size ?? null,
        caption: input.caption ?? null,
        clientId: input.clientId ?? null,
        sortOrder: Number(max ?? -1) + 1,
      });
      await db.update(schema.reports).set({ updatedAt: new Date() }).where(eq(schema.reports.id, report.id));

      const [row] = await db.select().from(schema.photos).where(eq(schema.photos.id, id));
      return { ...row, thumbUrl: await presignGet(row.thumbKey ?? row.storageKey) };
    }),

  /** Paged thumbnails — never returns every photo of an inspection at once. */
  list: authed
    .input(
      z.object({
        reportId: z.string().optional(),
        roomId: z.string().optional(),
        itemId: z.string().optional(),
        propertyId: z.string().optional(),
        limit: z.number().int().min(1).max(120).default(60),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .handler(async ({ input, context }) => {
      const where = [];
      if (input.reportId) {
        await loadReport(input.reportId, context.user.id, context.user.role);
        where.push(eq(schema.photos.reportId, input.reportId));
      }
      if (input.roomId) where.push(eq(schema.photos.roomId, input.roomId));
      if (input.itemId) where.push(eq(schema.photos.itemId, input.itemId));
      if (input.propertyId) where.push(eq(schema.photos.propertyId, input.propertyId));
      if (!where.length) throw new ORPCError("BAD_REQUEST", { message: "A scope is required" });

      const rows = await db
        .select()
        .from(schema.photos)
        .where(and(...where))
        .orderBy(schema.photos.sortOrder)
        .limit(input.limit + 1)
        .offset(input.offset);

      const page = rows.slice(0, input.limit);
      return {
        photos: await Promise.all(
          page.map(async (p) => ({
            id: p.id,
            roomId: p.roomId,
            itemId: p.itemId,
            caption: p.caption,
            createdAt: p.createdAt,
            thumbUrl: await presignGet(p.thumbKey ?? p.storageKey),
          })),
        ),
        nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
      };
    }),

  /** Full-size URL, fetched only when a photo is opened. */
  full: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.id, input.id));
    if (!photo) throw new ORPCError("NOT_FOUND");
    if (photo.reportId) await loadReport(photo.reportId, context.user.id, context.user.role);
    return { id: photo.id, url: await presignGet(photo.storageKey), caption: photo.caption };
  }),

  updateCaption: authed
    .input(z.object({ id: z.string(), caption: z.string().max(300).nullable() }))
    .handler(async ({ input, context }) => {
      const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.id, input.id));
      if (!photo) throw new ORPCError("NOT_FOUND");
      if (photo.reportId) {
        const report = await loadReport(photo.reportId, context.user.id, context.user.role);
        assertEditable(report);
      }
      const [row] = await db
        .update(schema.photos)
        .set({ caption: input.caption })
        .where(eq(schema.photos.id, input.id))
        .returning();
      return row;
    }),

  remove: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.id, input.id));
    if (!photo) throw new ORPCError("NOT_FOUND");
    if (photo.reportId) {
      const report = await loadReport(photo.reportId, context.user.id, context.user.role);
      assertEditable(report);
    }
    await db.delete(schema.photos).where(eq(schema.photos.id, input.id));
    await deleteObject(photo.storageKey);
    if (photo.thumbKey) await deleteObject(photo.thumbKey);
    return { ok: true };
  }),
};
