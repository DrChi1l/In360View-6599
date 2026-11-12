import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One row per Supabase Auth user (auth.users). Supabase owns the login (email, password,
 * sessions); this table holds what the app adds: display name, company, phone and role.
 * A database trigger creates the row on sign-up (see drizzle/0002_supabase_auth.sql); the
 * API also creates it on first use as a safety net. Read and written only by the server.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().default(""),
  name: text("name").notNull().default(""),
  companyName: text("company_name"),
  phone: text("phone"),
  role: text("role").notNull().default("clerk"),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date", precision: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).defaultNow().notNull(),
});
