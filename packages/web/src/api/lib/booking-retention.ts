import { and, inArray, lt } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { COMPLETED_RETENTION_YEARS, UNCONFIRMED_RETENTION_MONTHS } from "./booking-terms";

/** Statuses for requests that never turned into a visit. */
const UNCONFIRMED = ["new", "declined"];
/** Statuses for bookings that went ahead. */
const COMPLETED = ["confirmed", "done"];

export function retentionCutoffs(at: Date = new Date()) {
  const unconfirmed = new Date(at);
  unconfirmed.setMonth(unconfirmed.getMonth() - UNCONFIRMED_RETENTION_MONTHS);
  const completed = new Date(at);
  completed.setFullYear(completed.getFullYear() - COMPLETED_RETENTION_YEARS);
  return { unconfirmed, completed };
}

/**
 * Deletes booking requests that are past the retention periods promised in the
 * privacy notice. Unconfirmed/declined requests age from submission; confirmed
 * and completed bookings age from their last update.
 */
export async function purgeExpiredBookings(at: Date = new Date()) {
  const cut = retentionCutoffs(at);
  const stale = await db
    .delete(schema.bookingRequests)
    .where(
      and(
        inArray(schema.bookingRequests.status, UNCONFIRMED),
        lt(schema.bookingRequests.createdAt, cut.unconfirmed),
      ),
    )
    .returning({ id: schema.bookingRequests.id });
  const old = await db
    .delete(schema.bookingRequests)
    .where(
      and(
        inArray(schema.bookingRequests.status, COMPLETED),
        lt(schema.bookingRequests.updatedAt, cut.completed),
      ),
    )
    .returning({ id: schema.bookingRequests.id });
  return { unconfirmed: stale.length, completed: old.length };
}

const HOUR = 60 * 60 * 1000;
let lastRun = 0;

/** Runs the purge at most once an hour; never throws into the caller. */
export function purgeExpiredBookingsSoon() {
  const t = Date.now();
  if (t - lastRun < HOUR) return;
  lastRun = t;
  purgeExpiredBookings()
    .then((r) => {
      if (r.unconfirmed || r.completed) {
        console.info(`[retention] deleted ${r.unconfirmed} unconfirmed and ${r.completed} completed bookings`);
      }
    })
    .catch((err) => {
      lastRun = 0;
      console.error("[retention] booking purge failed", err);
    });
}

let scheduled = false;

/** Daily background purge for as long as the server process is up. */
export function scheduleBookingRetention() {
  if (scheduled || process.env.NODE_ENV === "test") return;
  scheduled = true;
  setTimeout(purgeExpiredBookingsSoon, 60_000).unref?.();
  setInterval(purgeExpiredBookingsSoon, 24 * HOUR).unref?.();
}
