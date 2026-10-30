import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { authed } from "../middleware/auth";

/**
 * One global search across properties and reports — address, postcode, tenant
 * or landlord name, property reference/id and report reference/id.
 */
export const search = {
  global: authed
    .input(z.object({ q: z.string().max(120), limit: z.number().int().min(1).max(40).default(12) }))
    .handler(async ({ input, context }) => {
      const term = input.q.trim();
      if (term.length < 2) return { properties: [], reports: [] };
      const q = `%${term}%`;
      const isAdmin = context.user.role === "admin";

      const propertyRows = await db
        .select({
          id: schema.properties.id,
          reference: schema.properties.reference,
          addressLine1: schema.properties.addressLine1,
          city: schema.properties.city,
          postcode: schema.properties.postcode,
          tenantName: schema.properties.tenantName,
          landlordName: schema.properties.landlordName,
          archived: schema.properties.archived,
        })
        .from(schema.properties)
        .where(
          and(
            isAdmin ? undefined : eq(schema.properties.userId, context.user.id),
            or(
              like(schema.properties.addressLine1, q),
              like(schema.properties.addressLine2, q),
              like(schema.properties.city, q),
              like(schema.properties.postcode, q),
              like(schema.properties.reference, q),
              like(schema.properties.tenantName, q),
              like(schema.properties.landlordName, q),
              like(schema.properties.id, q),
            ),
          ),
        )
        .orderBy(desc(schema.properties.updatedAt))
        .limit(input.limit);

      const reportRows = await db
        .select({
          id: schema.reports.id,
          type: schema.reports.type,
          status: schema.reports.status,
          reference: schema.reports.reference,
          inspectionDate: schema.reports.inspectionDate,
          propertyId: schema.properties.id,
          addressLine1: schema.properties.addressLine1,
          postcode: schema.properties.postcode,
        })
        .from(schema.reports)
        .innerJoin(schema.properties, eq(schema.properties.id, schema.reports.propertyId))
        .where(
          and(
            isAdmin ? undefined : eq(schema.reports.userId, context.user.id),
            or(
              like(schema.reports.reference, q),
              like(schema.reports.id, q),
              like(schema.properties.addressLine1, q),
              like(schema.properties.postcode, q),
              like(schema.properties.tenantName, q),
              like(schema.properties.landlordName, q),
            ),
          ),
        )
        .orderBy(desc(schema.reports.inspectionDate))
        .limit(input.limit);

      return { properties: propertyRows, reports: reportRows };
    }),
};
