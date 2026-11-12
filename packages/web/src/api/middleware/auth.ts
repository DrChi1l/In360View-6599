import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";
import { profiles } from "../database/schema";
import { verifyAccessToken, type Claims } from "../lib/supabase-auth";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  companyName?: string | null;
  phone?: string | null;
  disabled?: boolean | null;
};

/**
 * Operators named in ADMIN_EMAILS (comma-separated) are administrators. A role of "admin"
 * stored on the profile row is honoured too, but users cannot set it for themselves.
 */
function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * The profile for a verified login, created on first use if the sign-up trigger has not run.
 * Returns null when the account no longer exists in Supabase (a deleted user's token stays
 * valid until it expires), so they are treated as signed out.
 */
async function loadUser(claims: Claims): Promise<SessionUser | null> {
  let [row] = await db.select().from(profiles).where(eq(profiles.id, claims.id));
  if (!row) {
    try {
      [row] = await db
        .insert(profiles)
        .values({
          id: claims.id,
          email: claims.email,
          name: claims.name || claims.email.split("@")[0],
          companyName: claims.companyName,
        })
        .onConflictDoNothing()
        .returning();
    } catch {
      return null; // the foreign key to auth.users failed: that account is gone
    }
    if (!row) [row] = await db.select().from(profiles).where(eq(profiles.id, claims.id));
    if (!row) return null;
  }
  const operator = adminEmails().has(claims.email.toLowerCase());
  return {
    id: claims.id,
    name: row.name || claims.email,
    email: claims.email,
    image: null,
    role: operator ? "admin" : row.role,
    companyName: row.companyName,
    phone: row.phone,
    disabled: row.disabled,
  };
}

async function currentUser(headers: Headers): Promise<SessionUser | null> {
  const claims = await verifyAccessToken(headers);
  return claims ? loadUser(claims) : null;
}

/** Optional auth — `context.user` is the signed-in user or null. */
export const withUser = base.use(async ({ context, next }) => {
  const user = await currentUser(context.headers);
  return next({ context: { user: user?.disabled ? null : user, session: null } });
});

/** Protected procedures — rejects unauthenticated or disabled accounts. */
export const authed = base.use(async ({ context, next }) => {
  const user = await currentUser(context.headers);
  if (!user) throw new ORPCError("UNAUTHORIZED");
  if (user.disabled) throw new ORPCError("FORBIDDEN", { message: "This account has been disabled." });
  return next({ context: { user, session: null } });
});

/** Admin-only procedures. */
export const adminOnly = authed.use(async ({ context, next }) => {
  if (context.user.role !== "admin") throw new ORPCError("FORBIDDEN", { message: "Admin access required." });
  return next({ context });
});
