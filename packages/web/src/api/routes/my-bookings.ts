import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";
import {
  bookingsForEmail,
  customerView,
  emailForToken,
  normaliseEmail,
  sendLinkEmail,
  siteOrigin,
} from "../lib/booking-customer";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");

/** Hourly counter in the shared rate-limit table; returns false once `max` is passed. */
async function underLimit(key: string, max: number) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const [rate] = await db
    .insert(schema.tenantRateLimits)
    .values({ key: `${key}:${hour}`, hits: 1, expiresAt: new Date((hour + 2) * 3_600_000) })
    .onConflictDoUpdate({
      target: schema.tenantRateLimits.key,
      set: { hits: sql`${schema.tenantRateLimits.hits} + 1` },
    })
    .returning();
  return rate.hits <= max;
}

/**
 * Public "My bookings" for people who booked through the website. They have
 * no account: they ask for a link by email, or use the one in any booking email.
 */
export const myBookings = {
  /**
   * Emails a fresh private link — only if that address has bookings, and the
   * answer is the same either way so nobody can probe who has booked.
   */
  requestLink: base
    .input(z.object({ email: z.string().email().max(200), locale: z.enum(["en", "es"]).default("en") }))
    .handler(async ({ input, context }) => {
      const email = normaliseEmail(input.email);
      const allowed =
        (await underLimit(`booking-link:${digest(email)}`, 3)) && (await underLimit("booking-link:all", 200));
      if (!allowed) {
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message:
            input.locale === "es"
              ? "Ha pedido demasiados enlaces. Inténtelo de nuevo dentro de una hora."
              : "Too many link requests. Please try again in an hour.",
        });
      }
      const rows = await bookingsForEmail(email);
      if (rows.length) await sendLinkEmail(email, input.locale, siteOrigin(context.headers), rows.length);
      return { ok: true };
    }),

  /** The bookings behind a private link. */
  list: base.input(z.object({ token: z.string().max(100) })).handler(async ({ input }) => {
    const email = await emailForToken(input.token);
    if (!email) {
      throw new ORPCError("NOT_FOUND", { message: "This link has expired or is not valid." });
    }
    const rows = await bookingsForEmail(email);
    return { email, bookings: rows.map(customerView) };
  }),
};
