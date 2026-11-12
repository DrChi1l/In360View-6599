import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { suggestedRooms, templateFor } from "../lib/domain";
import { newId, newReference } from "../lib/ids";
import { presignGet } from "../lib/s3";
import { authed } from "../middleware/auth";
import { assertPropertyAccess } from "./properties";

export async function loadReport(reportId: string, userId: string, role?: string | null) {
  const [report] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId));
  if (!report) throw new ORPCError("NOT_FOUND", { message: "Report not found" });
  if (report.userId !== userId && role !== "admin") throw new ORPCError("FORBIDDEN");
  return report;
}

export function assertEditable(report: typeof schema.reports.$inferSelect) {
  if (report.lockedAt) {
    throw new ORPCError("CONFLICT", { message: "This report is signed and locked. Changes are not allowed." });
  }
}

async function seedRoomsFromTemplates(
  reportId: string,
  roomDefs: { type: string; name: string }[],
) {
  let roomOrder = 0;
  for (const def of roomDefs) {
    const roomId = newId("rm");
    await db.insert(schema.rooms).values({
      id: roomId,
      reportId,
      name: def.name,
      roomType: def.type,
      sortOrder: roomOrder++,
    });
    const template = templateFor(def.type);
    const itemNames = template?.items ?? [];
    if (itemNames.length) {
      await db.insert(schema.items).values(
        itemNames.map((name, i) => ({
          id: newId("itm"),
          roomId,
          reportId,
          name,
          sortOrder: i,
        })),
      );
    }
  }
}

/** Copy the room/item structure of a check-in into a new check-out report. */
async function copyStructureFromReport(sourceReportId: string, targetReportId: string) {
  const sourceRooms = await db
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.reportId, sourceReportId))
    .orderBy(schema.rooms.sortOrder);
  const sourceItems = await db
    .select()
    .from(schema.items)
    .where(eq(schema.items.reportId, sourceReportId))
    .orderBy(schema.items.sortOrder);

  for (const room of sourceRooms) {
    const roomId = newId("rm");
    await db.insert(schema.rooms).values({
      id: roomId,
      reportId: targetReportId,
      name: room.name,
      roomType: room.roomType,
      sortOrder: room.sortOrder,
    });
    const roomItems = sourceItems.filter((i) => i.roomId === room.id);
    if (roomItems.length) {
      await db.insert(schema.items).values(
        roomItems.map((item) => ({
          id: newId("itm"),
          roomId,
          reportId: targetReportId,
          name: item.name,
          sortOrder: item.sortOrder,
          quantity: item.quantity,
          previousItemId: item.id,
          changeStatus: "unchanged" as const,
        })),
      );
    }
  }
}

export const reports = {
  list: authed
    .input(
      z
        .object({
          propertyId: z.string().optional(),
          type: z.enum(["check_in", "check_out", "mid_term"]).optional(),
          status: z.enum(["draft", "completed", "signed"]).optional(),
          from: z.number().optional(),
          to: z.number().optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .default({ limit: 100 }),
    )
    .handler(async ({ input, context }) => {
      const where = [];
      if (context.user.role !== "admin") where.push(eq(schema.reports.userId, context.user.id));
      if (input.propertyId) where.push(eq(schema.reports.propertyId, input.propertyId));
      if (input.type) where.push(eq(schema.reports.type, input.type));
      if (input.status) where.push(eq(schema.reports.status, input.status));
      if (input.from) where.push(gte(schema.reports.inspectionDate, new Date(input.from)));
      if (input.to) where.push(lte(schema.reports.inspectionDate, new Date(input.to)));

      const rows = await db
        .select({
          report: schema.reports,
          property: schema.properties,
          photoCount: sql<number>`(select count(*) from photos where photos.report_id = reports.id)`,
          roomCount: sql<number>`(select count(*) from rooms where rooms.report_id = reports.id)`,
          completedRooms: sql<number>`(select count(*) from rooms where rooms.report_id = reports.id and rooms.completed = true)`,
          signatureCount: sql<number>`(select count(*) from signatures where signatures.report_id = reports.id)`,
        })
        .from(schema.reports)
        .innerJoin(schema.properties, eq(schema.properties.id, schema.reports.propertyId))
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(schema.reports.updatedAt))
        .limit(input.limit);

      return rows.map((r) => ({
        ...r.report,
        photoCount: Number(r.photoCount ?? 0),
        roomCount: Number(r.roomCount ?? 0),
        completedRooms: Number(r.completedRooms ?? 0),
        signatureCount: Number(r.signatureCount ?? 0),
        property: {
          id: r.property.id,
          addressLine1: r.property.addressLine1,
          postcode: r.property.postcode,
          reference: r.property.reference,
          city: r.property.city,
          tenantName: r.property.tenantName,
          landlordName: r.property.landlordName,
        },
      }));
    }),

  /** Full report tree — rooms, items and photo metadata (thumbnails presigned). */
  get: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.id, context.user.id, context.user.role);
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.id, report.propertyId));

    const roomRows = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.reportId, report.id))
      .orderBy(schema.rooms.sortOrder);
    const itemRows = await db
      .select()
      .from(schema.items)
      .where(eq(schema.items.reportId, report.id))
      .orderBy(schema.items.sortOrder);
    const photoRows = await db
      .select({
        id: schema.photos.id,
        roomId: schema.photos.roomId,
        itemId: schema.photos.itemId,
        thumbKey: schema.photos.thumbKey,
        storageKey: schema.photos.storageKey,
        caption: schema.photos.caption,
        sortOrder: schema.photos.sortOrder,
        width: schema.photos.width,
        height: schema.photos.height,
        createdAt: schema.photos.createdAt,
      })
      .from(schema.photos)
      .where(eq(schema.photos.reportId, report.id))
      .orderBy(schema.photos.sortOrder);

    const signatureRows = await db
      .select()
      .from(schema.signatures)
      .where(eq(schema.signatures.reportId, report.id));
    const meters = await db
      .select()
      .from(schema.meterReadings)
      .where(eq(schema.meterReadings.reportId, report.id));
    const keys = await db.select().from(schema.keySets).where(eq(schema.keySets.reportId, report.id));

    // Previous check-in data for a check-out comparison.
    let previousItems: Record<string, { condition: string | null; cleanliness: string | null; description: string | null }> = {};
    if (report.baseReportId) {
      const baseItems = await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.reportId, report.baseReportId));
      previousItems = Object.fromEntries(
        baseItems.map((i) => [
          i.id,
          { condition: i.condition, cleanliness: i.cleanliness, description: i.description },
        ]),
      );
    }

    const photos = await Promise.all(
      photoRows.map(async (p) => ({
        id: p.id,
        roomId: p.roomId,
        itemId: p.itemId,
        caption: p.caption,
        sortOrder: p.sortOrder,
        width: p.width,
        height: p.height,
        thumbUrl: await presignGet(p.thumbKey ?? p.storageKey),
        fullUrl: await presignGet(p.storageKey),
      })),
    );

    return {
      report,
      property,
      rooms: roomRows.map((room) => ({
        ...room,
        items: itemRows.filter((i) => i.roomId === room.id),
        photoCount: photos.filter((p) => p.roomId === room.id).length,
      })),
      photos,
      signatures: await Promise.all(
        signatureRows.map(async (s) => ({ ...s, url: await presignGet(s.storageKey) })),
      ),
      meters,
      keys,
      previousItems,
      /**
       * The property's uploaded front elevation, when there is one. The report
       * view prefers it over guessing a cover photograph from the inspection.
       */
      frontPhoto: property.frontPhotoKey
        ? {
            id: `front-${property.id}`,
            caption: "Front of the property",
            width: property.frontPhotoWidth,
            height: property.frontPhotoHeight,
            thumbUrl: await presignGet(property.frontPhotoThumbKey ?? property.frontPhotoKey),
            fullUrl: await presignGet(property.frontPhotoKey),
          }
        : null,
      pdfUrl: report.pdfKey ? await presignGet(report.pdfKey) : null,
    };
  }),

  create: authed
    .input(
      z.object({
        propertyId: z.string(),
        type: z.enum(["check_in", "check_out", "mid_term"]),
        baseReportId: z.string().optional().nullable(),
        inspectionDate: z.number().optional(),
        tenantPresent: z.boolean().default(false),
        /** Seed rooms: template keys + names. Omitted, they are derived from the property. */
        rooms: z.array(z.object({ type: z.string(), name: z.string().min(1).max(120) })).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const property = await assertPropertyAccess(input.propertyId, context.user.id, context.user.role);
      const id = newId("rep");

      await db.insert(schema.reports).values({
        id,
        propertyId: input.propertyId,
        userId: context.user.id,
        type: input.type,
        reference: newReference(input.type),
        baseReportId: input.baseReportId ?? null,
        inspectionDate: input.inspectionDate ? new Date(input.inspectionDate) : new Date(),
        clerkName: context.user.name,
        clerkEmail: context.user.email,
        tenantPresent: input.tenantPresent,
      });

      if (input.type === "check_out" && input.baseReportId) {
        await copyStructureFromReport(input.baseReportId, id);
      } else {
        const roomDefs =
          input.rooms?.length
            ? input.rooms
            : suggestedRooms({
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                otherRooms: property.otherRooms,
              });
        await seedRoomsFromTemplates(id, roomDefs);
      }

      await db.insert(schema.auditLog).values({
        id: newId("aud"),
        userId: context.user.id,
        entityType: "report",
        entityId: id,
        action: "created",
        detail: input.type,
      });

      const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, id));
      return row;
    }),

  update: authed
    .input(
      z.object({
        id: z.string(),
        inspectionDate: z.number().optional(),
        tenantPresent: z.boolean().optional(),
        weather: z.string().max(120).optional().nullable(),
        generalCondition: z.string().max(60).optional().nullable(),
        generalCleanliness: z.string().max(60).optional().nullable(),
        maintenanceIssues: z.string().max(6000).optional().nullable(),
        tenantObservations: z.string().max(6000).optional().nullable(),
        summaryNotes: z.string().max(6000).optional().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const report = await loadReport(input.id, context.user.id, context.user.role);
      assertEditable(report);
      const { id, inspectionDate, ...rest } = input;
      const [row] = await db
        .update(schema.reports)
        .set({
          ...rest,
          ...(inspectionDate ? { inspectionDate: new Date(inspectionDate) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.reports.id, id))
        .returning();
      return row;
    }),

  /** Marks the report completed — still editable until it is signed and locked. */
  complete: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.id, context.user.id, context.user.role);
    assertEditable(report);
    const [row] = await db
      .update(schema.reports)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.reports.id, input.id))
      .returning();
    await db.insert(schema.auditLog).values({
      id: newId("aud"),
      userId: context.user.id,
      entityType: "report",
      entityId: input.id,
      action: "completed",
    });
    return row;
  }),

  reopen: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.id, context.user.id, context.user.role);
    if (report.lockedAt) {
      throw new ORPCError("CONFLICT", { message: "Signed reports cannot be reopened." });
    }
    const [row] = await db
      .update(schema.reports)
      .set({ status: "draft", completedAt: null, updatedAt: new Date() })
      .where(eq(schema.reports.id, input.id))
      .returning();
    return row;
  }),

  remove: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.id, context.user.id, context.user.role);
    if (report.lockedAt) throw new ORPCError("CONFLICT", { message: "Signed reports cannot be deleted." });
    await db.delete(schema.items).where(eq(schema.items.reportId, report.id));
    await db.delete(schema.rooms).where(eq(schema.rooms.reportId, report.id));
    await db.delete(schema.photos).where(eq(schema.photos.reportId, report.id));
    await db.delete(schema.signatures).where(eq(schema.signatures.reportId, report.id));
    await db.delete(schema.meterReadings).where(eq(schema.meterReadings.reportId, report.id));
    await db.delete(schema.keySets).where(eq(schema.keySets.reportId, report.id));
    await db.delete(schema.reports).where(eq(schema.reports.id, report.id));
    return { ok: true };
  }),

  /** Check-in reports available as the basis for a check-out. */
  baseCandidates: authed
    .input(z.object({ propertyId: z.string() }))
    .handler(async ({ input, context }) => {
      await assertPropertyAccess(input.propertyId, context.user.id, context.user.role);
      return db
        .select({
          id: schema.reports.id,
          reference: schema.reports.reference,
          inspectionDate: schema.reports.inspectionDate,
          status: schema.reports.status,
          type: schema.reports.type,
        })
        .from(schema.reports)
        .where(
          and(
            eq(schema.reports.propertyId, input.propertyId),
            inArray(schema.reports.type, ["check_in", "mid_term"]),
          ),
        )
        .orderBy(desc(schema.reports.inspectionDate));
    }),

  meters: {
    save: authed
      .input(
        z.object({
          reportId: z.string(),
          readings: z.array(
            z.object({
              meterType: z.string().max(40),
              serialNumber: z.string().max(80).optional().nullable(),
              reading: z.string().max(80).optional().nullable(),
              location: z.string().max(160).optional().nullable(),
              notes: z.string().max(500).optional().nullable(),
            }),
          ),
        }),
      )
      .handler(async ({ input, context }) => {
        const report = await loadReport(input.reportId, context.user.id, context.user.role);
        assertEditable(report);
        await db.delete(schema.meterReadings).where(eq(schema.meterReadings.reportId, report.id));
        if (input.readings.length) {
          await db.insert(schema.meterReadings).values(
            input.readings.map((r) => ({ id: newId("mtr"), reportId: report.id, ...r })),
          );
        }
        return db.select().from(schema.meterReadings).where(eq(schema.meterReadings.reportId, report.id));
      }),
  },

  keys: {
    save: authed
      .input(
        z.object({
          reportId: z.string(),
          keys: z.array(
            z.object({
              description: z.string().min(1).max(160),
              quantity: z.number().int().min(0).max(99).default(1),
              notes: z.string().max(500).optional().nullable(),
            }),
          ),
        }),
      )
      .handler(async ({ input, context }) => {
        const report = await loadReport(input.reportId, context.user.id, context.user.role);
        assertEditable(report);
        await db.delete(schema.keySets).where(eq(schema.keySets.reportId, report.id));
        if (input.keys.length) {
          await db
            .insert(schema.keySets)
            .values(input.keys.map((k) => ({ id: newId("key"), reportId: report.id, ...k })));
        }
        return db.select().from(schema.keySets).where(eq(schema.keySets.reportId, report.id));
      }),
  },
};
