import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { newId } from "../lib/ids";
import { deleteObject, presignGet, presignPut } from "../lib/s3";
import { authed } from "../middleware/auth";

const propertyInput = z.object({
  reference: z.string().max(60).optional().nullable(),
  addressLine1: z.string().min(1, "Address is required").max(200),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  postcode: z.string().min(2, "Postcode is required").max(12),
  propertyType: z.string().max(80).optional().nullable(),
  furnishing: z.string().max(60).optional().nullable(),
  bedrooms: z.number().int().min(0).max(30).default(0),
  bathrooms: z.number().int().min(0).max(30).default(0),
  otherRooms: z.number().int().min(0).max(60).default(0),
  landlordName: z.string().max(160).optional().nullable(),
  landlordEmail: z.string().max(200).optional().nullable(),
  tenantName: z.string().max(160).optional().nullable(),
  tenantEmail: z.string().max(200).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

/** Properties the signed-in user may see: their own, or everything for an admin. */
function ownershipFilter(userId: string, role?: string | null) {
  return role === "admin" ? undefined : eq(schema.properties.userId, userId);
}

/**
 * Presigned URLs for a property's front elevation. Returned alongside the
 * property everywhere it is listed or read so the cover photograph can be shown
 * without a second round trip.
 */
export async function frontPhotoUrls(property: {
  frontPhotoKey: string | null;
  frontPhotoThumbKey: string | null;
}) {
  if (!property.frontPhotoKey) return { frontPhotoUrl: null, frontPhotoThumbUrl: null };
  return {
    frontPhotoUrl: await presignGet(property.frontPhotoKey),
    frontPhotoThumbUrl: await presignGet(property.frontPhotoThumbKey ?? property.frontPhotoKey),
  };
}

export async function assertPropertyAccess(propertyId: string, userId: string, role?: string | null) {
  const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId));
  if (!property) throw new ORPCError("NOT_FOUND", { message: "Property not found" });
  if (property.userId !== userId && role !== "admin") throw new ORPCError("FORBIDDEN");
  return property;
}

export const properties = {
  list: authed
    .input(
      z
        .object({
          search: z.string().max(120).optional(),
          includeArchived: z.boolean().default(false),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .default({ includeArchived: false, limit: 100 }),
    )
    .handler(async ({ input, context }) => {
      const where = [ownershipFilter(context.user.id, context.user.role)];
      if (!input.includeArchived) where.push(eq(schema.properties.archived, false));
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        where.push(
          or(
            ilike(schema.properties.addressLine1, q),
            ilike(schema.properties.postcode, q),
            ilike(schema.properties.city, q),
            ilike(schema.properties.reference, q),
            ilike(schema.properties.tenantName, q),
            ilike(schema.properties.landlordName, q),
          ),
        );
      }
      const rows = await db
        .select({
          property: schema.properties,
          reportCount: sql<number>`(select count(*) from reports where reports.property_id = properties.id)`,
          lastReportAt: sql<Date | string | null>`(select max(reports.inspection_date) from reports where reports.property_id = properties.id)`,
        })
        .from(schema.properties)
        .where(and(...where.filter(Boolean)))
        .orderBy(desc(schema.properties.updatedAt))
        .limit(input.limit);

      return Promise.all(
        rows.map(async (r) => ({
          ...r.property,
          ...(await frontPhotoUrls(r.property)),
          reportCount: Number(r.reportCount ?? 0),
          lastReportAt: r.lastReportAt ? new Date(r.lastReportAt) : null,
        })),
      );
    }),

  get: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const property = await assertPropertyAccess(input.id, context.user.id, context.user.role);

    const reports = await db
      .select({
        id: schema.reports.id,
        type: schema.reports.type,
        status: schema.reports.status,
        reference: schema.reports.reference,
        inspectionDate: schema.reports.inspectionDate,
        completedAt: schema.reports.completedAt,
        lockedAt: schema.reports.lockedAt,
        pdfKey: schema.reports.pdfKey,
        roomCount: sql<number>`(select count(*) from rooms where rooms.report_id = reports.id)`,
        photoCount: sql<number>`(select count(*) from photos where photos.report_id = reports.id)`,
      })
      .from(schema.reports)
      .where(eq(schema.reports.propertyId, input.id))
      .orderBy(desc(schema.reports.inspectionDate));

    const recentPhotos = await db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.propertyId, input.id))
      .orderBy(desc(schema.photos.createdAt))
      .limit(24);

    const upcoming = await db
      .select()
      .from(schema.scheduledInspections)
      .where(
        and(
          eq(schema.scheduledInspections.propertyId, input.id),
          eq(schema.scheduledInspections.status, "scheduled"),
        ),
      )
      .orderBy(schema.scheduledInspections.scheduledFor);

    return {
      property: { ...property, ...(await frontPhotoUrls(property)) },
      reports: reports.map((r) => ({ ...r, roomCount: Number(r.roomCount ?? 0), photoCount: Number(r.photoCount ?? 0) })),
      recentPhotos: await Promise.all(
        recentPhotos.map(async (p) => ({
          id: p.id,
          reportId: p.reportId,
          url: await presignGet(p.thumbKey ?? p.storageKey),
        })),
      ),
      upcoming,
    };
  }),

  create: authed.input(propertyInput).handler(async ({ input, context }) => {
    const id = newId("prp");
    const [row] = await db
      .insert(schema.properties)
      .values({ id, userId: context.user.id, ...input })
      .returning();
    return row;
  }),

  update: authed
    .input(propertyInput.partial().extend({ id: z.string() }))
    .handler(async ({ input, context }) => {
      await assertPropertyAccess(input.id, context.user.id, context.user.role);
      const { id, ...values } = input;
      const [row] = await db
        .update(schema.properties)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(schema.properties.id, id))
        .returning();
      return row;
    }),

  /**
   * Front elevation, step 1: presigned PUT URLs for the full-size image and its
   * thumbnail. The browser downscales both locally and uploads straight to
   * storage, so the bytes never pass through the API.
   */
  frontPhotoPresign: authed
    .input(z.object({ propertyId: z.string(), contentType: z.string().max(120).default("image/jpeg") }))
    .handler(async ({ input, context }) => {
      const property = await assertPropertyAccess(input.propertyId, context.user.id, context.user.role);
      const ext = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
      // Files live in the owner's folder so the Flutter app (which can only reach its own
      // folder in Storage) sees them too.
      const base = `${property.userId}/properties/${input.propertyId}/front/${newId("fr")}`;
      const storageKey = `${base}.${ext}`;
      const thumbKey = `${base}_thumb.${ext}`;
      return {
        storageKey,
        thumbKey,
        uploadUrl: await presignPut(storageKey, input.contentType),
        thumbUploadUrl: await presignPut(thumbKey, input.contentType),
      };
    }),

  /** Front elevation, step 2: point the property at the uploaded image. */
  frontPhotoSet: authed
    .input(
      z.object({
        propertyId: z.string(),
        storageKey: z.string(),
        thumbKey: z.string().optional().nullable(),
        width: z.number().int().optional().nullable(),
        height: z.number().int().optional().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const property = await assertPropertyAccess(input.propertyId, context.user.id, context.user.role);
      const [row] = await db
        .update(schema.properties)
        .set({
          frontPhotoKey: input.storageKey,
          frontPhotoThumbKey: input.thumbKey ?? null,
          frontPhotoWidth: input.width ?? null,
          frontPhotoHeight: input.height ?? null,
          frontPhotoUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.properties.id, input.propertyId))
        .returning();

      /* Replacing the photograph: drop the bytes the property no longer uses. */
      if (property.frontPhotoKey && property.frontPhotoKey !== input.storageKey) {
        await deleteObject(property.frontPhotoKey);
        if (property.frontPhotoThumbKey) await deleteObject(property.frontPhotoThumbKey);
      }
      return { ...row, ...(await frontPhotoUrls(row)) };
    }),

  frontPhotoRemove: authed.input(z.object({ propertyId: z.string() })).handler(async ({ input, context }) => {
    const property = await assertPropertyAccess(input.propertyId, context.user.id, context.user.role);
    await db
      .update(schema.properties)
      .set({
        frontPhotoKey: null,
        frontPhotoThumbKey: null,
        frontPhotoWidth: null,
        frontPhotoHeight: null,
        frontPhotoUpdatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.id, input.propertyId));
    if (property.frontPhotoKey) await deleteObject(property.frontPhotoKey);
    if (property.frontPhotoThumbKey) await deleteObject(property.frontPhotoThumbKey);
    return { ok: true };
  }),

  setArchived: authed
    .input(z.object({ id: z.string(), archived: z.boolean() }))
    .handler(async ({ input, context }) => {
      await assertPropertyAccess(input.id, context.user.id, context.user.role);
      const [row] = await db
        .update(schema.properties)
        .set({ archived: input.archived, updatedAt: new Date() })
        .where(eq(schema.properties.id, input.id))
        .returning();
      return row;
    }),

  remove: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const property = await assertPropertyAccess(input.id, context.user.id, context.user.role);
    if (property.frontPhotoKey) await deleteObject(property.frontPhotoKey);
    if (property.frontPhotoThumbKey) await deleteObject(property.frontPhotoThumbKey);
    const reportRows = await db
      .select({ id: schema.reports.id })
      .from(schema.reports)
      .where(eq(schema.reports.propertyId, input.id));
    for (const r of reportRows) {
      await db.delete(schema.items).where(eq(schema.items.reportId, r.id));
      await db.delete(schema.rooms).where(eq(schema.rooms.reportId, r.id));
      await db.delete(schema.signatures).where(eq(schema.signatures.reportId, r.id));
      await db.delete(schema.meterReadings).where(eq(schema.meterReadings.reportId, r.id));
      await db.delete(schema.keySets).where(eq(schema.keySets.reportId, r.id));
    }
    await db.delete(schema.photos).where(eq(schema.photos.propertyId, input.id));
    await db.delete(schema.reports).where(eq(schema.reports.propertyId, input.id));
    await db.delete(schema.scheduledInspections).where(eq(schema.scheduledInspections.propertyId, input.id));
    await db.delete(schema.properties).where(eq(schema.properties.id, input.id));
    return { ok: true };
  }),

  schedule: authed
    .input(
      z.object({
        propertyId: z.string(),
        type: z.enum(["check_in", "check_out", "mid_term"]),
        scheduledFor: z.number(),
        notes: z.string().max(1000).optional().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      await assertPropertyAccess(input.propertyId, context.user.id, context.user.role);
      const [row] = await db
        .insert(schema.scheduledInspections)
        .values({
          id: newId("sch"),
          propertyId: input.propertyId,
          userId: context.user.id,
          type: input.type,
          scheduledFor: new Date(input.scheduledFor),
          notes: input.notes ?? null,
        })
        .returning();
      return row;
    }),

  cancelSchedule: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [row] = await db
      .select()
      .from(schema.scheduledInspections)
      .where(eq(schema.scheduledInspections.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND");
    if (row.userId !== context.user.id && context.user.role !== "admin") throw new ORPCError("FORBIDDEN");
    await db
      .update(schema.scheduledInspections)
      .set({ status: "cancelled" })
      .where(eq(schema.scheduledInspections.id, input.id));
    return { ok: true };
  }),
};
