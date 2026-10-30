import { afterAll, expect, test } from "bun:test";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { eq } from "drizzle-orm";
import type { AppRouterClient } from "../src/api";
import { db } from "../src/api/database";
import * as schema from "../src/api/database/schema";
import { BOOKING_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from "../src/api/lib/booking-terms";
import { roomsSummary } from "../src/api/lib/booking-rooms";
import {
  CANONICAL_ORIGIN,
  bookingIcs,
  customerView,
  issueBookingLink,
  siteOrigin,
} from "../src/api/lib/booking-customer";

const client: AppRouterClient = createORPCClient(new RPCLink({ url: "http://localhost:4200/api/rpc" }));
const TEST_EMAIL = "booking-terms-test@example.com";

const booking = {
  requestedDate: "2030-02-11",
  requestedTime: "09:30",
  contactName: "My Bookings Test",
  contactEmail: TEST_EMAIL,
  contactPhone: "07000 000000",
  propertyAddress: "2 Test Road, Testtown, AB1 2CD",
  furnishing: "Unfurnished",
  inspectionType: "Check-In Inventory",
  acceptTerms: true as const,
  acceptPrivacy: true as const,
  termsVersion: BOOKING_TERMS_VERSION,
  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
};

afterAll(async () => {
  await db.delete(schema.bookingRequests).where(eq(schema.bookingRequests.contactEmail, TEST_EMAIL));
  await db.delete(schema.bookingAccessLinks).where(eq(schema.bookingAccessLinks.email, TEST_EMAIL));
});

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return "OK";
}

test("room counts are stored, and out-of-range counts are refused", async () => {
  const { id } = await client.bookings.request({ ...booking, bedrooms: 0, bathrooms: 2, receptionRooms: 4 });
  const [row] = await db.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.id, id));
  expect([row.bedrooms, row.bathrooms, row.receptionRooms]).toEqual([0, 2, 4]);
  expect(await code(client.bookings.request({ ...booking, bedrooms: 7 }))).toBe("BAD_REQUEST");
  expect(await code(client.bookings.request({ ...booking, bathrooms: -1 }))).toBe("BAD_REQUEST");
});

test("rooms summary reads naturally in English and Spanish", () => {
  expect(roomsSummary({ bedrooms: 0, bathrooms: 1, receptionRooms: 1 })).toBe("Studio · 1 bathroom · 1 reception room");
  expect(roomsSummary({ bedrooms: 6, bathrooms: 5, receptionRooms: 4 })).toBe(
    "6+ bedrooms · 5+ bathrooms · 4+ reception rooms",
  );
  expect(roomsSummary({ bedrooms: 2, bathrooms: 1, receptionRooms: 0 }, "es")).toBe("2 dormitorios · 1 baño · 0 salones");
  expect(roomsSummary({})).toBeNull();
});

test("a private link shows that email's bookings, without office-only fields", async () => {
  const url = await issueBookingLink(TEST_EMAIL, CANONICAL_ORIGIN);
  expect(url.startsWith(`${CANONICAL_ORIGIN}/my-bookings/`)).toBe(true);
  const token = url.split("/").pop()!;
  const res = await client.myBookings.list({ token });
  expect(res.email).toBe(TEST_EMAIL);
  expect(res.bookings.length).toBeGreaterThan(0);
  const first = res.bookings[0] as Record<string, unknown>;
  for (const hidden of ["internalNotes", "termsVersion", "contactPhone", "tenantEmail", "id"]) {
    expect(hidden in first).toBe(false);
  }
  // Not booked in yet, so no confirmed slot is shown.
  expect(first.status).toBe("new");
  expect(first.confirmedDate).toBeNull();

  // Only the digest is stored.
  const links = await db.select().from(schema.bookingAccessLinks).where(eq(schema.bookingAccessLinks.email, TEST_EMAIL));
  expect(links.some((l) => l.tokenHash === token)).toBe(false);
});

test("unknown and expired links are refused", async () => {
  expect(await code(client.myBookings.list({ token: "x".repeat(32) }))).toBe("NOT_FOUND");
  const url = await issueBookingLink(TEST_EMAIL, CANONICAL_ORIGIN);
  const token = url.split("/").pop()!;
  await db
    .update(schema.bookingAccessLinks)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(schema.bookingAccessLinks.email, TEST_EMAIL));
  expect(await code(client.myBookings.list({ token }))).toBe("NOT_FOUND");
});

test("asking for a link never reveals whether an email has bookings, and is rate limited", async () => {
  const stranger = `nobody-${Date.now()}@example.com`;
  expect(await client.myBookings.requestLink({ email: stranger, locale: "en" })).toEqual({ ok: true });
  await client.myBookings.requestLink({ email: stranger, locale: "en" });
  await client.myBookings.requestLink({ email: stranger, locale: "en" });
  expect(await code(client.myBookings.requestLink({ email: stranger, locale: "en" }))).toBe("TOO_MANY_REQUESTS");
});

test("links in emails only ever point at our own site", () => {
  const h = (origin: string) => new Headers({ origin });
  expect(siteOrigin(h("https://evil.example"))).toBe(CANONICAL_ORIGIN);
  expect(siteOrigin(h("https://in360view.co.uk"))).toBe(CANONICAL_ORIGIN);
  expect(siteOrigin(h("http://localhost:4200"))).toBe("http://localhost:4200");
  expect(siteOrigin()).toBe(CANONICAL_ORIGIN);
});

test("calendar invite uses the booked-in slot", async () => {
  const [row] = await db.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.contactEmail, TEST_EMAIL));
  const confirmed = { ...row, status: "confirmed", confirmedDate: "2030-02-12", confirmedTime: "14:15", accessNotes: "Keys with neighbour, no. 4; alarm 1234" };
  const ics = bookingIcs(confirmed);
  expect(ics).toContain("DTSTART:20300212T141500");
  expect(ics).toContain("DTEND:20300212T161500");
  expect(ics).toContain("no. 4\\; alarm");
  for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  expect(customerView(confirmed).confirmedTime).toBe("14:15");
});
