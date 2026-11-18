import type { Context } from "hono";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";
import { authed, currentUser } from "../middleware/auth";
import { escapeHtml, sendEmail, emailConfigured } from "../lib/email";
import {
  tenantCreateSchema,
  tenantSaveSchema,
  tenantSubmitSchema,
  tokenInput,
} from "../lib/tenant-contract";
import {
  createTenantReport,
  getTenantReport,
  getTenantStatusForReport,
  issueTenantLink,
  reserveTenantUpload,
  saveTenantResponse,
  tenantLimit,
  verifyTenantUpload,
} from "../lib/tenant-store";
import { collectReportData } from "./documents";
import { loadReport } from "./reports";
import { photoOpenUrl } from "../lib/links";
import type { Condition, Cleanliness, ReportType } from "../lib/domain";
import type { TenantCreate } from "../lib/tenant-contract";

/** App-to-website ingestion webhook: anonymous by explicit design. */
export async function ingestTenantReport(c: Context) {
  c.header("Cache-Control", "no-store");
  c.header("X-Robots-Tag", "noindex, nofollow");
  try {
    await tenantLimit(c.req.raw.headers, "create", 60);
    if (!c.req.header("content-type")?.includes("application/json"))
      return c.json({ error: "Send application/json." }, 415);
    const reader = c.req.raw.body?.getReader();
    if (!reader) return c.json({ error: "Report JSON is required." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        return c.json({ error: "Report exceeds 2 MB JSON limit." }, 413);
      }
      chunks.push(chunk.value);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return c.json({ error: "Invalid JSON." }, 400);
    }
    const parsed = tenantCreateSchema.safeParse(body);
    if (!parsed.success)
      return c.json(
        {
          error: "Invalid report format.",
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        400,
      );
    return c.json(await createTenantReport(parsed.data), 201);
  } catch (error) {
    if (error instanceof ORPCError && error.code === "TOO_MANY_REQUESTS")
      return c.json({ error: error.message }, 429);
    console.error(
      "Tenant report ingestion failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    return c.json({ error: "Unable to save report. Please try again." }, 500);
  }
}

/** Raw JSON response stream for external app integrations (not an RPC envelope). */
export async function streamTenantReport(c: Context) {
  c.header("Cache-Control", "no-store");
  c.header("X-Robots-Tag", "noindex, nofollow");
  c.header("Referrer-Policy", "no-referrer");
  try {
    const token = c.req.param("token") ?? "";
    await tenantLimit(c.req.raw.headers, "read", 240, token);
    const json = JSON.stringify(await getTenantReport(token));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(json));
        controller.close();
      },
    });
    c.header("Content-Type", "application/json; charset=utf-8");
    return c.body(stream, 200);
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND")
      return c.json({ error: "This report link is not valid." }, 404);
    if (error instanceof ORPCError && error.code === "TOO_MANY_REQUESTS")
      return c.json({ error: error.message }, 429);
    return c.json({ error: "Unable to load report. Please try again." }, 500);
  }
}

type ReportRow = typeof schema.reports.$inferSelect;

/** The read-only copy of a report that a tenant is shown. Built on the server from the database. */
export async function buildTenantSnapshot(report: ReportRow): Promise<TenantCreate> {
  const data = await collectReportData(report.id);
  const photoRows = await db.select().from(schema.photos).where(eq(schema.photos.reportId, report.id));
  const meterRows = await db.select().from(schema.meterReadings).where(eq(schema.meterReadings.reportId, report.id));
  const keyRows = await db.select().from(schema.keySets).where(eq(schema.keySets.reportId, report.id));
  const alarmRows = await db.select().from(schema.alarmChecks).where(eq(schema.alarmChecks.reportId, report.id));
  const link = (id: string) => photoOpenUrl(id) ?? `https://in360view.co.uk/api/photos/${id}/open`;
  const urls = (roomId?: string, itemId?: string) =>
    photoRows
      .filter((p) => (itemId ? p.itemId === itemId : p.roomId === roomId && !p.itemId))
      .map((p) => link(p.id));
  const of = (key: "meterId" | "keyId" | "alarmId", id: string) =>
    photoRows.filter((p) => p[key] === id).map((p) => link(p.id));
  return {
    schemaVersion: 1,
    report: {
      reference: report.reference ?? report.id,
      type: report.type as ReportType,
      inspectionDate: report.inspectionDate.toISOString().slice(0, 10),
      inspectorName: report.clerkName ?? "In360View",
      property: {
        address: [data.property.addressLine1, data.property.addressLine2, data.property.city]
          .filter(Boolean)
          .join(", "),
        postcode: data.property.postcode,
      },
      summary: [
        report.summaryNotes,
        report.maintenanceIssues ? `Maintenance: ${report.maintenanceIssues}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      photoUrls: photoRows
        .filter((p) => !p.roomId && !p.itemId && !p.meterId && !p.keyId && !p.alarmId)
        .map((p) => link(p.id)),
      rooms: data.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        notes: r.notes ?? "",
        photoUrls: urls(r.id),
        items: r.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          description: i.description ?? "",
          notes: i.notes ?? "",
          condition: i.condition as Condition | null,
          cleanliness: i.cleanliness as Cleanliness | null,
          photoUrls: urls(r.id, i.id),
        })),
      })),
      meters: meterRows.map((m) => ({
        type: m.meterType,
        reading: m.reading,
        serialNumber: m.serialNumber,
        location: m.location,
        photoUrls: of("meterId", m.id),
      })),
      keys: keyRows.map((k) => ({
        description: k.description,
        quantity: k.quantity,
        notes: k.notes,
        photoUrls: of("keyId", k.id),
      })),
      alarms: alarmRows.map((a) => ({
        type: a.alarmType,
        location: a.location,
        status: a.status,
        notes: a.notes,
        photoUrls: of("alarmId", a.id),
      })),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Used by the inspector app (signed in with Supabase, bearer token). Plain JSON routes.

function appError(c: Context, error: unknown) {
  if (error instanceof ORPCError) {
    const status =
      error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "CONFLICT" ? 409 : error.code === "TOO_MANY_REQUESTS" ? 429 : error.code === "BAD_REQUEST" ? 400 : 500;
    return c.json({ error: error.message }, status);
  }
  console.error("App tenant link failed", error instanceof Error ? error.name : "Unknown error");
  return c.json({ error: "Something went wrong. Please try again." }, 500);
}

async function appReport(c: Context, reportId: string) {
  const user = await currentUser(c.req.raw.headers);
  if (!user || user.disabled) return { fail: c.json({ error: "Sign in to continue." }, 401) };
  const report = await loadReport(reportId, user.id, user.role);
  if (report.userId !== user.id && user.role !== "admin")
    throw new ORPCError("FORBIDDEN", { message: "Only the owner of a report (or an admin) can send it to a tenant." });
  return { user, report };
}

/** POST /api/app/tenant-link  { reportId, email? } -> { url, emailed, sentTo } */
export async function appSendTenantLink(c: Context) {
  c.header("Cache-Control", "no-store");
  try {
    const body = z
      .object({ reportId: z.string().min(1).max(100), email: z.string().email().max(254).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Enter a valid email address, or leave it empty." }, 400);
    const found = await appReport(c, body.data.reportId);
    if ("fail" in found) return found.fail;
    const { user, report } = found;
    await tenantLimit(c.req.raw.headers, "app-send", 60, user.id);
    if (report.status === "draft")
      throw new ORPCError("CONFLICT", { message: "Complete this inspection before sharing it with the tenant." });
    if (report.lockedAt)
      throw new ORPCError("CONFLICT", { message: "This report is signed and locked, so it can no longer be sent." });

    const email = body.data.email?.trim().toLowerCase();
    const issued = await issueTenantLink(await buildTenantSnapshot(report), report.id, email);

    let emailed = false;
    let emailError: string | null = null;
    if (email && emailConfigured()) {
      const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, report.propertyId));
      const plainAddress = [property?.addressLine1, property?.postcode].filter(Boolean).join(", ");
      const address = escapeHtml(plainAddress);
      const who = escapeHtml(report.clerkName ?? "Your inspector");
      const url = issued.url;
      try {
        await sendEmail({
          to: email,
          replyTo: user.email,
          subject: `Please review and sign your inspection report - ${plainAddress}`,
          text: `${report.clerkName ?? "Your inspector"} has sent you the inspection report for ${plainAddress}.\n\nPlease read it, add any comments or photographs, and sign:\n${url}\n\nThis link is private. Please do not share it.`,
          html: `<p>${who} has sent you the inspection report for <strong>${address}</strong>.</p><p>Please read it, add any comments or photographs, and sign:</p><p><a href="${url}">Review and sign the report</a></p><p style="color:#666;font-size:13px">This link is private. Please do not share it.</p>`,
        });
        emailed = true;
      } catch (error) {
        console.error("Tenant link email failed", error instanceof Error ? error.message : "Unknown error");
        emailError = error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
      }
    } else if (email) {
      emailError = "Email is not set up on the server (RESEND_API_KEY is missing).";
    }
    return c.json({ url: issued.url, emailed, sentTo: email ?? null, emailError });
  } catch (error) {
    return appError(c, error);
  }
}

/** GET /api/app/tenant-link/:reportId -> { status: none | open | submitted, ... } */
export async function appTenantLinkStatus(c: Context) {
  c.header("Cache-Control", "no-store");
  try {
    const found = await appReport(c, c.req.param("reportId") ?? "");
    if ("fail" in found) return found.fail;
    return c.json(await getTenantStatusForReport(found.report.id));
  } catch (error) {
    return appError(c, error);
  }
}

/** Typed, token-authorised tenant actions. None require a login/session. */
export const tenantReport = {
  create: base.input(tenantCreateSchema).handler(async ({ input, context }) => {
    await tenantLimit(context.headers, "create", 60);
    return createTenantReport(input);
  }),
  get: base.input(tokenInput).handler(async ({ input, context }) => {
    await tenantLimit(context.headers, "read", 240, input.token);
    return getTenantReport(input.token);
  }),
  save: base.input(tenantSaveSchema).handler(async ({ input, context }) => {
    await tenantLimit(context.headers, "write", 120, input.token);
    return saveTenantResponse(input.token, input.revision, input.response);
  }),
  submit: base.input(tenantSubmitSchema).handler(async ({ input, context }) => {
    await tenantLimit(context.headers, "write", 120, input.token);
    return saveTenantResponse(input.token, input.revision, input.response, true);
  }),
  upload: base
    .input(
      tokenInput.extend({
        kind: z.enum(["photo", "signature"]),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        bytes: z
          .number()
          .int()
          .min(1)
          .max(8 * 1024 * 1024),
      }),
    )
    .handler(async ({ input, context }) => {
      await tenantLimit(context.headers, "upload", 40, input.token);
      return reserveTenantUpload(input.token, input.kind, input.contentType, input.bytes);
    }),
  verifyUpload: base
    .input(tokenInput.extend({ assetId: z.string().max(100) }))
    .handler(async ({ input, context }) => {
      await tenantLimit(context.headers, "verify", 80, input.token);
      return verifyTenantUpload(input.token, input.assetId);
    }),
  /** Staff shortcut: publishes a snapshot, without altering/locking the staff report. */
  publish: authed.input(z.object({ reportId: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.reportId, context.user.id, context.user.role);
    if (report.status === "draft")
      throw new ORPCError("CONFLICT", {
        message: "Complete this inspection before sharing it with the tenant.",
      });
    return createTenantReport(await buildTenantSnapshot(report), report.id);
  }),
};
