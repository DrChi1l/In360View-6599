import { desc, eq, ne, and, sql } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { authed } from "../middleware/auth";

/**
 * The agency portal: what an agency account can follow without any inspection tools.
 * Bookings are matched by the account's email (the one used on the booking form); reports and
 * invoices by the agency link on the property and the invoice.
 */
export const portal = {
  overview: authed.handler(async ({ context }) => {
    const email = context.user.email.trim().toLowerCase();

    const bookings = await db
      .select({
        id: schema.bookingRequests.id,
        reference: schema.bookingRequests.reference,
        status: schema.bookingRequests.status,
        propertyAddress: schema.bookingRequests.propertyAddress,
        inspectionType: schema.bookingRequests.inspectionType,
        requestedDate: schema.bookingRequests.requestedDate,
        requestedTime: schema.bookingRequests.requestedTime,
        confirmedDate: schema.bookingRequests.confirmedDate,
        confirmedTime: schema.bookingRequests.confirmedTime,
        createdAt: schema.bookingRequests.createdAt,
      })
      .from(schema.bookingRequests)
      .where(sql`lower(${schema.bookingRequests.contactEmail}) = ${email}`)
      .orderBy(desc(schema.bookingRequests.createdAt))
      .limit(100);

    const reports = await db
      .select({
        id: schema.reports.id,
        type: schema.reports.type,
        status: schema.reports.status,
        reference: schema.reports.reference,
        inspectionDate: schema.reports.inspectionDate,
        completedAt: schema.reports.completedAt,
        addressLine1: schema.properties.addressLine1,
        city: schema.properties.city,
        postcode: schema.properties.postcode,
        roomCount: sql<number>`(select count(*) from rooms where rooms.report_id = reports.id)`,
        completedRooms: sql<number>`(select count(*) from rooms where rooms.report_id = reports.id and rooms.completed = true)`,
      })
      .from(schema.reports)
      .innerJoin(schema.properties, eq(schema.properties.id, schema.reports.propertyId))
      .where(eq(schema.properties.agencyUserId, context.user.id))
      .orderBy(desc(schema.reports.inspectionDate))
      .limit(100);

    const [latestInvoice] = await db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.clientUserId, context.user.id), ne(schema.invoices.status, "draft")))
      .orderBy(desc(schema.invoices.issueDate), desc(schema.invoices.createdAt))
      .limit(1);

    return {
      account: { name: context.user.name, email: context.user.email, companyName: context.user.companyName ?? null, phone: context.user.phone ?? null },
      bookings,
      reports,
      latestInvoice: latestInvoice ?? null,
    };
  }),
};
