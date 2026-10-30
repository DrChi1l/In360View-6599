import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { authed } from "../middleware/auth";

/** Everything the home screen shows, in one round trip. */
export const dashboard = {
  summary: authed.handler(async ({ context }) => {
    const isAdmin = context.user.role === "admin";
    const mineProperties = isAdmin ? undefined : eq(schema.properties.userId, context.user.id);
    const mineReports = isAdmin ? undefined : eq(schema.reports.userId, context.user.id);

    const [[propertyCounts], [reportCounts]] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`sum(case when ${schema.properties.archived} = 0 then 1 else 0 end)`,
        })
        .from(schema.properties)
        .where(mineProperties),
      db
        .select({
          total: sql<number>`count(*)`,
          drafts: sql<number>`sum(case when ${schema.reports.status} = 'draft' then 1 else 0 end)`,
          completed: sql<number>`sum(case when ${schema.reports.status} = 'completed' then 1 else 0 end)`,
          signed: sql<number>`sum(case when ${schema.reports.status} = 'signed' then 1 else 0 end)`,
        })
        .from(schema.reports)
        .where(mineReports),
    ]);

    const recentReports = await db
      .select({
        id: schema.reports.id,
        type: schema.reports.type,
        status: schema.reports.status,
        reference: schema.reports.reference,
        inspectionDate: schema.reports.inspectionDate,
        updatedAt: schema.reports.updatedAt,
        propertyId: schema.properties.id,
        addressLine1: schema.properties.addressLine1,
        postcode: schema.properties.postcode,
        roomCount: sql<number>`(select count(*) from rooms where rooms.report_id = reports.id)`,
        completedRooms: sql<number>`(select count(*) from rooms where rooms.report_id = reports.id and rooms.completed = 1)`,
        photoCount: sql<number>`(select count(*) from photos where photos.report_id = reports.id)`,
      })
      .from(schema.reports)
      .innerJoin(schema.properties, eq(schema.properties.id, schema.reports.propertyId))
      .where(mineReports)
      .orderBy(desc(schema.reports.updatedAt))
      .limit(6);

    const upcoming = await db
      .select({
        id: schema.scheduledInspections.id,
        type: schema.scheduledInspections.type,
        scheduledFor: schema.scheduledInspections.scheduledFor,
        notes: schema.scheduledInspections.notes,
        propertyId: schema.properties.id,
        addressLine1: schema.properties.addressLine1,
        postcode: schema.properties.postcode,
      })
      .from(schema.scheduledInspections)
      .innerJoin(schema.properties, eq(schema.properties.id, schema.scheduledInspections.propertyId))
      .where(
        and(
          eq(schema.scheduledInspections.status, "scheduled"),
          gte(schema.scheduledInspections.scheduledFor, new Date(Date.now() - 86_400_000)),
          isAdmin ? undefined : eq(schema.scheduledInspections.userId, context.user.id),
        ),
      )
      .orderBy(asc(schema.scheduledInspections.scheduledFor))
      .limit(6);

    const photoTotal = await db
      .select({ total: sql<number>`count(*)` })
      .from(schema.photos)
      .where(
        isAdmin
          ? undefined
          : sql`${schema.photos.propertyId} in (select ${schema.properties.id} from ${schema.properties} where ${schema.properties.userId} = ${context.user.id})`,
      );

    return {
      user: {
        name: context.user.name,
        email: context.user.email,
        role: context.user.role ?? "clerk",
        companyName: context.user.companyName ?? null,
      },
      properties: {
        total: Number(propertyCounts?.total ?? 0),
        active: Number(propertyCounts?.active ?? 0),
      },
      reports: {
        total: Number(reportCounts?.total ?? 0),
        drafts: Number(reportCounts?.drafts ?? 0),
        completed: Number(reportCounts?.completed ?? 0),
        signed: Number(reportCounts?.signed ?? 0),
      },
      photos: Number(photoTotal[0]?.total ?? 0),
      recentReports,
      upcoming,
    };
  }),
};
