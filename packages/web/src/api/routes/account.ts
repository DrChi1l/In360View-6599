import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { SELF_ASSIGNABLE_ROLES } from "../lib/domain";
import { authed, withUser } from "../middleware/auth";

export const account = {
  /** The signed-in user, or null — used to gate the UI. */
  me: withUser.handler(async ({ context }) => {
    if (!context.user) return null;
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, context.user.id));
    if (!row) return null;
    const [subscription] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, row.id));
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      image: null,
      // The operator list (ADMIN_EMAILS) can grant admin without a database change.
      role: context.user.role ?? row.role ?? "clerk",
      companyName: row.companyName,
      phone: row.phone,
      disabled: row.disabled,
      subscription: subscription ?? null,
    };
  }),

  updateProfile: authed
    .input(
      z.object({
        name: z.string().min(1).max(160).optional(),
        companyName: z.string().max(160).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        // "admin" is deliberately not selectable: it would let anyone read every account's data.
        role: z.enum(SELF_ASSIGNABLE_ROLES).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const [row] = await db
        .update(schema.profiles)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(schema.profiles.id, context.user.id))
        .returning();
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: context.user.role === "admin" ? "admin" : row.role,
        companyName: row.companyName,
        phone: row.phone,
      };
    }),
};
