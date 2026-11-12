import { createRemoteJWKSet, jwtVerify } from "jose";

/** Project URL, e.g. https://abcd.supabase.co. Server and browser share the same variable. */
export function supabaseUrl() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

let keys: ReturnType<typeof createRemoteJWKSet> | null = null;
let keysFor: string | null = null;

export type Claims = { id: string; email: string; name: string | null; companyName: string | null };

/**
 * Checks the `Authorization: Bearer <access token>` header against the project's public
 * signing keys (JWKS), so no secret is needed and no network call is made per request
 * after the keys are cached. Returns null for a missing, expired, forged or foreign token.
 */
export async function verifyAccessToken(headers: Headers): Promise<Claims | null> {
  const header = headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const url = supabaseUrl();
  if (!token || !url) return null;
  if (!keys || keysFor !== url) {
    keys = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`), { cooldownDuration: 30_000 });
    keysFor = url;
  }
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `${url}/auth/v1`,
      audience: "authenticated",
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
    return {
      id: payload.sub,
      email: payload.email,
      name: typeof meta.name === "string" ? meta.name : null,
      companyName: typeof meta.company_name === "string" ? meta.company_name : null,
    };
  } catch {
    return null;
  }
}
