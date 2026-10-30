import { afterAll, expect, test } from "bun:test";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { eq, inArray } from "drizzle-orm";
import type { AppRouterClient } from "../src/api";
import { db } from "../src/api/database";
import * as schema from "../src/api/database/schema";
import {
  BOOKING_TERMS,
  BOOKING_TERMS_VERSION,
  KEY_POINTS,
  PRIVACY_NOTICE,
  PRIVACY_NOTICE_VERSION,
} from "../src/api/lib/booking-terms";
import { BOOKING_TERMS_ES, KEY_POINTS_ES, PRIVACY_NOTICE_ES } from "../src/api/lib/booking-terms-es";
import { purgeExpiredBookings } from "../src/api/lib/booking-retention";

const client: AppRouterClient = createORPCClient(new RPCLink({ url: "http://localhost:4200/api/rpc" }));
const TEST_EMAIL = "booking-terms-test@example.com";

const booking = {
  requestedDate: "2030-01-15",
  requestedTime: "10:00",
  contactName: "Terms Test",
  contactEmail: TEST_EMAIL,
  contactPhone: "07000 000000",
  propertyAddress: "1 Test Street, Testtown, AB1 2CD",
  furnishing: "Unfurnished",
  inspectionType: "Check-In Inventory",
  tenantName: null,
  tenantEmail: null,
  tenantPhone: null,
  accessNotes: null,
};
const agreement = {
  acceptTerms: true as const,
  acceptPrivacy: true as const,
  termsVersion: BOOKING_TERMS_VERSION,
  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
};

afterAll(async () => {
  await db.delete(schema.bookingRequests).where(eq(schema.bookingRequests.contactEmail, TEST_EMAIL));
});

async function rejection(input: unknown) {
  try {
    await client.bookings.request(input as Parameters<typeof client.bookings.request>[0]);
  } catch (err) {
    return err as { code?: string; message: string };
  }
  throw new Error("Expected the booking to be rejected");
}

test("server refuses bookings without explicit, current agreement", async () => {
  expect((await rejection(booking)).code).toBe("BAD_REQUEST");
  expect((await rejection({ ...booking, ...agreement, acceptTerms: false })).code).toBe("BAD_REQUEST");
  expect((await rejection({ ...booking, ...agreement, acceptPrivacy: false })).code).toBe("BAD_REQUEST");
  const stale = await rejection({ ...booking, ...agreement, termsVersion: "booking-terms-old" });
  expect(stale.code).toBe("CONFLICT");

  const rows = await db
    .select()
    .from(schema.bookingRequests)
    .where(eq(schema.bookingRequests.contactEmail, TEST_EMAIL));
  expect(rows.length).toBe(0);
});

test("accepted booking stores the agreed versions and time", async () => {
  const before = Date.now();
  const { id, reference } = await client.bookings.request({ ...booking, ...agreement });
  expect(reference).toMatch(/^BK-/);
  const [row] = await db.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.id, id));
  expect(row.termsVersion).toBe(BOOKING_TERMS_VERSION);
  expect(row.privacyNoticeVersion).toBe(PRIVACY_NOTICE_VERSION);
  expect(row.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  expect("acceptTerms" in row).toBe(false);
});

test("Spanish translation mirrors the English documents section for section", () => {
  expect(BOOKING_TERMS_ES.map((x) => x.id)).toEqual(BOOKING_TERMS.map((x) => x.id));
  expect(PRIVACY_NOTICE_ES.map((x) => x.id)).toEqual(PRIVACY_NOTICE.map((x) => x.id));
  expect(KEY_POINTS_ES.length).toBe(KEY_POINTS.length);
  for (const [es, en] of [
    [BOOKING_TERMS_ES, BOOKING_TERMS],
    [PRIVACY_NOTICE_ES, PRIVACY_NOTICE],
  ] as const) {
    es.forEach((section, i) => {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.title).not.toBe(en[i].title);
    });
  }
});

test("booking records the language the terms were shown in", async () => {
  const es = await client.bookings.request({ ...booking, ...agreement, locale: "es" });
  const en = await client.bookings.request({ ...booking, ...agreement });
  const rows = await db
    .select()
    .from(schema.bookingRequests)
    .where(inArray(schema.bookingRequests.id, [es.id, en.id]));
  expect(rows.find((r) => r.id === es.id)?.locale).toBe("es");
  expect(rows.find((r) => r.id === en.id)?.locale).toBe("en");
  expect(rows.find((r) => r.id === es.id)?.termsVersion).toBe(BOOKING_TERMS_VERSION);
  expect((await rejection({ ...booking, ...agreement, locale: "fr" })).code).toBe("BAD_REQUEST");
});

test("retention purge deletes only bookings past their period", async () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const monthsAgo = (m: number) => new Date(new Date(now).setMonth(now.getMonth() - m));
  const yearsAgo = (y: number) => new Date(new Date(now).setFullYear(now.getFullYear() - y));
  const base = { ...booking, reference: "BK-RTEST" };
  const rows = [
    { id: "bkg_rt_new_old", status: "new", createdAt: monthsAgo(13), updatedAt: monthsAgo(13), gone: true },
    { id: "bkg_rt_dec_old", status: "declined", createdAt: monthsAgo(13), updatedAt: monthsAgo(1), gone: true },
    { id: "bkg_rt_new_recent", status: "new", createdAt: monthsAgo(11), updatedAt: monthsAgo(11), gone: false },
    { id: "bkg_rt_done_old", status: "done", createdAt: yearsAgo(8), updatedAt: yearsAgo(7), gone: true },
    { id: "bkg_rt_done_kept", status: "done", createdAt: yearsAgo(8), updatedAt: yearsAgo(5), gone: false },
    { id: "bkg_rt_conf_kept", status: "confirmed", createdAt: monthsAgo(20), updatedAt: monthsAgo(20), gone: false },
  ];
  await db.insert(schema.bookingRequests).values(rows.map(({ gone: _gone, ...r }) => ({ ...base, ...r })));

  const result = await purgeExpiredBookings(now);
  expect(result.unconfirmed).toBeGreaterThanOrEqual(2);
  expect(result.completed).toBeGreaterThanOrEqual(1);

  const left = await db
    .select({ id: schema.bookingRequests.id })
    .from(schema.bookingRequests)
    .where(inArray(schema.bookingRequests.id, rows.map((r) => r.id)));
  expect(left.map((r) => r.id).sort()).toEqual(rows.filter((r) => !r.gone).map((r) => r.id).sort());
});
