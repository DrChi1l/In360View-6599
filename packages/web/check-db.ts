/**
 * Checks that the website can reach its database and that the login tables exist.
 *   cd packages/web && bun --env-file=../../.env check-db.ts
 * Prints no secrets.
 */
import postgres from "postgres";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL is not set");
const url = new URL(raw);
console.log(`host: ${url.hostname}  port: ${url.port || 5432}  user: ${url.username}`);
if (/^db\..*\.supabase\.co$/.test(url.hostname)) {
  console.log("WARNING: this is the IPv6-only direct host. Use the connection pooler string from Dashboard > Connect.");
}
const sql = postgres(raw, { prepare: false, ssl: "require", max: 1, connect_timeout: 10 });
try {
  const rows = await sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('user','account','session','verification') order by 1`;
  console.log("connected. login tables found:", rows.map((r) => r.table_name).join(", ") || "none (run the migration)");
  const [{ n }] = await sql`select count(*)::int as n from "user"`;
  console.log(`accounts in the database: ${n}`);
} catch (e: any) {
  console.log("FAILED:", e?.code ?? "", String(e?.message ?? e).slice(0, 160));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
