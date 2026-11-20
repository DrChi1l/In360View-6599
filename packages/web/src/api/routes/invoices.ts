import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { loadLogoBytes } from "../lib/brand";
import { buildInvoicePdf } from "../lib/invoice-pdf";
import { newId } from "../lib/ids";
import { DEFAULT_RATES, paymentInfo } from "../lib/invoice-config";
import { REPORT_TYPE_LABELS, type ReportType } from "../lib/domain";
import { adminOnly, authed } from "../middleware/auth";

const lineSchema = z.object({
  reportId: z.string().optional().nullable(),
  description: z.string().min(1).max(300),
  rate: z.number().min(0).max(100_000),
  qty: z.number().int().min(1).max(1000),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

async function nextNumber() {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(cast(${schema.invoices.number} as integer)), 0)` })
    .from(schema.invoices)
    .where(sql`${schema.invoices.number} ~ '^[0-9]+$'`);
  return String((row?.max ?? 0) + 1).padStart(5, "0");
}

/** Completed/signed jobs that could go on an invoice, with a suggested line for each. */
async function jobLines(where: ReturnType<typeof and>) {
  const rows = await db
    .select({ report: schema.reports, property: schema.properties })
    .from(schema.reports)
    .innerJoin(schema.properties, eq(schema.properties.id, schema.reports.propertyId))
    .where(where)
    .orderBy(schema.reports.inspectionDate);
  return rows.map(({ report, property }) => ({
    reportId: report.id,
    inspectionDate: report.inspectionDate,
    reference: report.reference,
    type: report.type,
    description: `${[property.addressLine1, property.city].filter(Boolean).join(", ")} (${
      REPORT_TYPE_LABELS[report.type as ReportType] ?? report.type
    })`,
    rate: DEFAULT_RATES[report.type] ?? 0,
    qty: 1,
  }));
}

/** Admins see every invoice; anyone else only their own, and never a draft. */
function visibleTo(user: { id: string; role?: string | null }, id?: string) {
  if (user.role === "admin") return id ? eq(schema.invoices.id, id) : undefined;
  const own = and(eq(schema.invoices.clientUserId, user.id), ne(schema.invoices.status, "draft"))!;
  return id ? and(eq(schema.invoices.id, id), own) : own;
}

export const invoices = {
  /** Accounts that have jobs, to pick a client from. */
  clients: adminOnly.handler(async () => {
    return db
      .select({
        id: schema.profiles.id,
        name: schema.profiles.name,
        email: schema.profiles.email,
        companyName: schema.profiles.companyName,
        role: schema.profiles.role,
      })
      .from(schema.profiles)
      .orderBy(schema.profiles.companyName, schema.profiles.name);
  }),

  /** Billable jobs for a client: one month (`month`, YYYY-MM) or a single job (`reportId`). */
  candidates: adminOnly
    .input(
      z.object({
        clientUserId: z.string(),
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
        reportId: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const conds = [
        // Jobs for an agency are the properties linked to it; the inspector owns the reports.
        or(eq(schema.properties.agencyUserId, input.clientUserId), eq(schema.reports.userId, input.clientUserId))!,
        inArray(schema.reports.status, ["completed", "signed"]),
      ];
      if (input.reportId) conds.push(eq(schema.reports.id, input.reportId));
      else if (input.month) {
        const { start, end } = monthRange(input.month);
        conds.push(gte(schema.reports.inspectionDate, start), lt(schema.reports.inspectionDate, end));
      } else throw new ORPCError("BAD_REQUEST", { message: "Choose a month or a job." });
      return jobLines(and(...conds));
    }),

  list: authed.handler(async ({ context }) => {
    return db
      .select()
      .from(schema.invoices)
      .where(visibleTo(context.user))
      .orderBy(desc(schema.invoices.issueDate), desc(schema.invoices.createdAt))
      .limit(200);
  }),

  get: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [row] = await db.select().from(schema.invoices).where(visibleTo(context.user, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
    return { ...row, paymentInfo: paymentInfo() };
  }),

  /** The invoice as a PDF, base64-encoded for the browser to save. */
  pdf: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [row] = await db.select().from(schema.invoices).where(visibleTo(context.user, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
    const bytes = await buildInvoicePdf({
      number: row.number,
      clientName: row.clientName,
      clientAddress: row.clientAddress,
      issueDate: row.issueDate,
      lines: row.lines,
      total: row.total,
      paymentInfo: paymentInfo(),
      logoBytes: await loadLogoBytes(),
    });
    return { filename: `Invoice ${row.number} - ${row.clientName}.pdf`.replace(/[\\/:*?"<>|]/g, ""), base64: Buffer.from(bytes).toString("base64") };
  }),

  create: adminOnly
    .input(
      z.object({
        clientUserId: z.string().optional().nullable(),
        clientName: z.string().min(1).max(200),
        clientAddress: z.string().max(500).optional().nullable(),
        issueDate: z.coerce.date().optional(),
        kind: z.enum(["month", "job", "custom"]),
        periodMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
        lines: z.array(lineSchema).min(1).max(200),
      }),
    )
    .handler(async ({ input, context }) => {
      const total = round2(input.lines.reduce((sum, l) => sum + l.rate * l.qty, 0));
      // Retry on a number clash (two admins issuing at the same moment).
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [row] = await db
            .insert(schema.invoices)
            .values({
              id: newId("inv"),
              number: await nextNumber(),
              clientUserId: input.clientUserId ?? null,
              clientName: input.clientName,
              clientAddress: input.clientAddress ?? null,
              issueDate: input.issueDate ?? new Date(),
              kind: input.kind,
              periodMonth: input.periodMonth ?? null,
              lines: input.lines.map((l) => ({ ...l, rate: round2(l.rate) })),
              total,
              createdBy: context.user.id,
            })
            .returning();
          await db.insert(schema.auditLog).values({
            id: newId("aud"),
            userId: context.user.id,
            entityType: "invoice",
            entityId: row.id,
            action: "created",
            detail: `${row.number} · ${row.clientName} · £${total.toFixed(2)}`,
          });
          return row;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }),

  setStatus: adminOnly
    .input(z.object({ id: z.string(), status: z.enum(["draft", "sent", "paid"]) }))
    .handler(async ({ input }) => {
      const [row] = await db
        .update(schema.invoices)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(schema.invoices.id, input.id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND");
      return row;
    }),

  remove: adminOnly.input(z.object({ id: z.string() })).handler(async ({ input }) => {
    await db.delete(schema.invoices).where(eq(schema.invoices.id, input.id));
    return { ok: true };
  }),
};
