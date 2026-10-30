import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { auth } from "../auth";

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

/** Optional auth — `context.user` is the session user or null. */
export const withUser = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  return next({
    context: {
      user: (session?.user ?? null) as SessionUser | null,
      session: session?.session ?? null,
    },
  });
});

/** Protected procedures — rejects unauthenticated or disabled accounts. */
export const authed = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  const user = session.user as SessionUser;
  if (user.disabled) throw new ORPCError("FORBIDDEN", { message: "This account has been disabled." });
  return next({ context: { user, session: session.session } });
});

/** Admin-only procedures. */
export const adminOnly = authed.use(async ({ context, next }) => {
  if (context.user.role !== "admin") throw new ORPCError("FORBIDDEN", { message: "Admin access required." });
  return next({ context });
});
