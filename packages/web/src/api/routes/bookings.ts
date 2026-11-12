import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";
import { BOOKING_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from "../lib/booking-terms";
import { purgeExpiredBookingsSoon, scheduleBookingRetention } from "../lib/booking-retention";
import { NOTIFY_EMAIL, detailRows, emailShell, escapeHtml, notify } from "../lib/email";
import { newId } from "../lib/ids";
import { MAX_BATHROOMS, MAX_BEDROOMS, MAX_RECEPTION, roomsSummary } from "../lib/booking-rooms";
import {
  PROPERTY_COUNTRIES,
  formatSpanishAddress,
  mapLink,
  provinceName,
  spanishAddressSchema,
  spanishAddressToProperty,
} from "../lib/spain-address";
import { adminOnly } from "../middleware/auth";
import { type BookingRow, sendConfirmedEmail, sendDeclinedEmail, sendReceivedEmail, siteOrigin } from "../lib/booking-customer";

export const BOOKING_STATUSES = ["new", "confirmed", "declined", "done"] as const;

const createInput = z
  .object({
  requestedDate: z.string().min(8).max(10),
  requestedTime: z.string().min(4).max(5),
  contactName: z.string().min(1, "Your name is required").max(160),
  contactEmail: z.string().email("Enter a valid email address").max(200),
  contactPhone: z.string().min(5, "A contact number is required").max(40),
  /** UK: one free-text line including the postcode. Spain: composed on the server from `propertyAddressEs`. */
  propertyAddress: z.string().max(300).optional().default(""),
  propertyCountry: z.enum(PROPERTY_COUNTRIES).optional().default("GB"),
  propertyAddressEs: spanishAddressSchema.optional().nullable(),
  bedrooms: z.number().int().min(0).max(MAX_BEDROOMS).optional().nullable(),
  bathrooms: z.number().int().min(0).max(MAX_BATHROOMS).optional().nullable(),
  receptionRooms: z.number().int().min(0).max(MAX_RECEPTION).optional().nullable(),
  furnishing: z.string().max(60).optional().nullable(),
  inspectionType: z.string().max(60).optional().nullable(),
  tenantName: z.string().max(160).optional().nullable(),
  tenantEmail: z.string().max(200).optional().nullable(),
  tenantPhone: z.string().max(40).optional().nullable(),
  accessNotes: z.string().max(2000).optional().nullable(),
  /** Explicit agreement captured in the booking pop-up — checked here, not just in the browser. */
  acceptTerms: z.literal(true, { message: "Please agree to the booking terms to continue." }),
  acceptPrivacy: z.literal(true, {
    message: "Please confirm you have read the privacy and data retention notice.",
  }),
  termsVersion: z.string().max(60),
  privacyNoticeVersion: z.string().max(60),
  /** Language the requester saw the form and terms in. */
  locale: z.enum(["en", "es"]).optional().default("en"),
})
  .superRefine((v, ctx) => {
    if (v.propertyCountry === "ES" && !v.propertyAddressEs) {
      ctx.addIssue({ code: "custom", path: ["propertyAddressEs"], message: "The property address is required" });
    }
    if (v.propertyCountry === "GB" && v.propertyAddress.trim().length < 4) {
      ctx.addIssue({ code: "custom", path: ["propertyAddress"], message: "The property address is required" });
    }
  });

scheduleBookingRetention();

/** Optional booked-in slot when the office confirms; defaults to the requested one. */
const slotInput = {
  confirmedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").optional(),
  confirmedTime: z.string().regex(/^\d{2}:\d{2}$/, "Use a valid time").optional(),
  /** Email the requester about the change (booked in / declined). */
  notifyCustomer: z.boolean().optional().default(true),
};

async function findBooking(id: string) {
  const [row] = await db.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.id, id));
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
  return row;
}

/** Sends "you're booked in" and records when, so the office can see it went. */
async function confirmAndEmail(row: BookingRow, headers: Headers) {
  const res = await sendConfirmedEmail(row, siteOrigin(headers));
  if (!res.sent) return { ...row, emailed: false };
  const [updated] = await db
    .update(schema.bookingRequests)
    .set({ confirmationSentAt: new Date() })
    .where(eq(schema.bookingRequests.id, row.id))
    .returning();
  return { ...updated, emailed: true };
}

function bookingReference() {
  return `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export const bookings = {
  /** Public — submitted from the landing page by people without an account. */
  request: base.input(createInput).handler(async ({ input, context }) => {
    const { acceptTerms: _t, acceptPrivacy: _p, termsVersion, privacyNoticeVersion, ...fields } = input;
    if (termsVersion !== BOOKING_TERMS_VERSION || privacyNoticeVersion !== PRIVACY_NOTICE_VERSION) {
      throw new ORPCError("CONFLICT", {
        message: "Our booking terms have been updated. Please reload the page and review them before booking.",
      });
    }
    purgeExpiredBookingsSoon();
    const es = fields.propertyCountry === "ES" ? fields.propertyAddressEs! : null;
    const row = {
      id: newId("bkg"),
      reference: bookingReference(),
      status: "new" as const,
      ...fields,
      propertyAddress: es ? formatSpanishAddress(es) : fields.propertyAddress.trim(),
      propertyAddressEs: es ? { ...es, postalCode: es.postalCode || null } : null,
      contactEmail: fields.contactEmail.trim().toLowerCase(),
      termsVersion,
      privacyNoticeVersion,
      termsAcceptedAt: new Date(),
    };
    const [saved] = await db.insert(schema.bookingRequests).values(row).returning();

    // The office finds out the moment a request lands — the booking is already
    // saved, so a mail failure is logged rather than shown to the requester.
    const service = row.inspectionType?.trim() || "Inventory / inspection visit";
    await notify({
      to: NOTIFY_EMAIL,
      replyTo: row.contactEmail,
      subject: `${row.locale === "es" ? "[ES] " : ""}New booking ${row.reference} — ${service} — ${row.propertyAddress}`,
      html: emailShell(
        "New booking request",
        detailRows([
          ["Reference", row.reference],
          ["Service", service],
          ["Requested", `${row.requestedDate} at ${row.requestedTime}`],
          ["Property", row.propertyAddress],
          ["Country", es ? "Spain" : "United Kingdom"],
          ...(es
            ? ([
                ["Province", provinceName(es.provinceCode)],
                ["Postcode", es.postalCode || "Not given (optional in Spain)"],
                ["Catastral ref (building)", es.catastralRef],
                ["Map", mapLink(es)],
              ] as [string, string | null][])
            : []),
          ["Rooms", roomsSummary(row)],
          ["Furnishing", row.furnishing],
          ["Contact", row.contactName],
          ["Email", row.contactEmail],
          ["Phone", row.contactPhone],
          ["Tenant", row.tenantName],
          ["Tenant email", row.tenantEmail],
          ["Tenant phone", row.tenantPhone],
          ["Terms agreed", `${row.termsVersion} · ${row.privacyNoticeVersion} · ${row.termsAcceptedAt.toISOString()}`],
          ["Language", row.locale === "es" ? "Spanish (Español) — reply in Spanish if you can" : "English"],
        ]) +
          (row.accessNotes
            ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5C5A6B">Keys / access notes</p>
  <p style="margin:0 0 16px;white-space:pre-wrap">${escapeHtml(row.accessNotes)}</p>`
            : "") +
          `<p style="margin:0;font-size:13px;color:#5C5A6B">Open the Bookings screen in In360View to confirm, decline, or turn this into a property.</p>`,
      ),
      text: [
        `New booking request ${row.reference}`,
        `Service: ${service}`,
        `Requested: ${row.requestedDate} at ${row.requestedTime}`,
        `Property: ${row.propertyAddress}`,
        `Contact: ${row.contactName} · ${row.contactEmail} · ${row.contactPhone}`,
        row.accessNotes ? `Access: ${row.accessNotes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    // The requester gets their own copy, with a private link to "My bookings".
    const ack = await sendReceivedEmail(saved, siteOrigin(context.headers));

    return { id: row.id, reference: row.reference, emailed: ack.sent };
  }),

  list: adminOnly
    .input(
      z
        .object({
          status: z.enum(["all", ...BOOKING_STATUSES]).default("all"),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .default({ status: "all", limit: 100 }),
    )
    .handler(async ({ input }) => {
      purgeExpiredBookingsSoon();
      const where = input.status === "all" ? undefined : eq(schema.bookingRequests.status, input.status);
      const rows = await db
        .select()
        .from(schema.bookingRequests)
        .where(where)
        .orderBy(desc(schema.bookingRequests.createdAt))
        .limit(input.limit);

      const counts = await db
        .select({ status: schema.bookingRequests.status, n: sql<number>`count(*)` })
        .from(schema.bookingRequests)
        .groupBy(schema.bookingRequests.status);

      const byStatus: Record<string, number> = { all: 0 };
      for (const s of BOOKING_STATUSES) byStatus[s] = 0;
      for (const c of counts) {
        byStatus[c.status] = Number(c.n);
        byStatus.all += Number(c.n);
      }
      return { bookings: rows, counts: byStatus };
    }),

  get: adminOnly.input(z.object({ id: z.string() })).handler(async ({ input }) => {
    const [row] = await db
      .select()
      .from(schema.bookingRequests)
      .where(eq(schema.bookingRequests.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
    return row;
  }),

  update: adminOnly
    .input(
      z.object({
        id: z.string(),
        status: z.enum(BOOKING_STATUSES).optional(),
        internalNotes: z.string().max(2000).optional().nullable(),
        ...slotInput,
      }),
    )
    .handler(async ({ input, context }) => {
      const { id, notifyCustomer, ...patch } = input;
      const before = await findBooking(id);
      const [row] = await db
        .update(schema.bookingRequests)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(schema.bookingRequests.id, id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Booking not found" });

      // Tell the requester when their booking is booked in or turned down.
      let emailed: boolean | null = null;
      if (notifyCustomer && patch.status && patch.status !== before.status) {
        if (patch.status === "confirmed") return { ...(await confirmAndEmail(row, context.headers)) };
        if (patch.status === "declined") emailed = (await sendDeclinedEmail(row)).sent;
      }
      return { ...row, emailed };
    }),

  /** Re-sends the "you're booked in" email, e.g. after the customer lost it. */
  resendConfirmation: adminOnly.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const row = await findBooking(input.id);
    if (row.status !== "confirmed") {
      throw new ORPCError("BAD_REQUEST", { message: "Only confirmed bookings have a confirmation to send." });
    }
    return confirmAndEmail(row, context.headers);
  }),

  remove: adminOnly.input(z.object({ id: z.string() })).handler(async ({ input }) => {
    await db.delete(schema.bookingRequests).where(eq(schema.bookingRequests.id, input.id));
    return { ok: true };
  }),

  /**
   * Turns a booking into a real property record so the clerk can start an
   * inspection from it. Address is stored as one line by the public form, so the
   * trailing comma-separated parts become the town and postcode where possible.
   */
  convert: adminOnly.input(z.object({ id: z.string(), ...slotInput })).handler(async ({ input, context }) => {
    const found = await findBooking(input.id);
    // Booking it in comes first, so the requester hears even if the property already exists.
    const [booking] = await db
      .update(schema.bookingRequests)
      .set({
        status: "confirmed",
        confirmedDate: input.confirmedDate ?? found.confirmedDate ?? found.requestedDate,
        confirmedTime: input.confirmedTime ?? found.confirmedTime ?? found.requestedTime,
        updatedAt: new Date(),
      })
      .where(eq(schema.bookingRequests.id, found.id))
      .returning();
    const alreadyConfirmed = found.status === "confirmed" && found.confirmationSentAt;
    const emailed =
      input.notifyCustomer && !alreadyConfirmed ? (await confirmAndEmail(booking, context.headers)).emailed : null;

    const esAddress = booking.propertyCountry === "ES" ? booking.propertyAddressEs : null;
    const parts = booking.propertyAddress
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const postcodeRe = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
    let postcode = "";
    if (parts.length > 1 && postcodeRe.test(parts[parts.length - 1])) postcode = parts.pop()!;
    const city = parts.length > 1 ? parts.pop()! : null;
    const addressLine1 = parts.shift() ?? booking.propertyAddress;
    const addressLine2 = parts.length ? parts.join(", ") : null;
    const split = esAddress
      ? spanishAddressToProperty(esAddress)
      : { addressLine1, addressLine2, city, postcode: postcode.toUpperCase() || "—" };

    const existing = await db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(
        and(
          eq(schema.properties.userId, context.user.id),
          eq(schema.properties.addressLine1, split.addressLine1),
        ),
      );
    if (existing.length) return { propertyId: existing[0].id, created: false, emailed };

    const property = {
      id: newId("prp"),
      userId: context.user.id,
      reference: booking.reference,
      ...split,
      furnishing: booking.furnishing,
      ...(booking.bedrooms != null ? { bedrooms: booking.bedrooms } : {}),
      ...(booking.bathrooms != null ? { bathrooms: booking.bathrooms } : {}),
      // The report template already includes one living room.
      ...(booking.receptionRooms != null ? { otherRooms: Math.max(0, booking.receptionRooms - 1) } : {}),
      tenantName: booking.tenantName,
      tenantEmail: booking.tenantEmail,
      landlordName: booking.contactName,
      landlordEmail: booking.contactEmail,
      notes: [
        `Booked online for ${booking.requestedDate} at ${booking.requestedTime}.`,
        booking.inspectionType ? `Requested: ${booking.inspectionType}.` : null,
        roomsSummary(booking) ? `Size given when booking: ${roomsSummary(booking)}.` : null,
        booking.accessNotes ? `Keys / access: ${booking.accessNotes}` : null,
        esAddress?.catastralRef ? `Catastral ref (building): ${esAddress.catastralRef}` : null,
        esAddress && mapLink(esAddress) ? `Map: ${mapLink(esAddress)}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
    await db.insert(schema.properties).values(property);
    return { propertyId: property.id, created: true, emailed };
  }),
};
