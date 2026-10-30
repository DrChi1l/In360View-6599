import type { Context } from "hono";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "../__core/app";
import { authed } from "../middleware/auth";
import {
  tenantCreateSchema,
  tenantSaveSchema,
  tenantSubmitSchema,
  tokenInput,
} from "../lib/tenant-contract";
import {
  createTenantReport,
  getTenantReport,
  reserveTenantUpload,
  saveTenantResponse,
  tenantLimit,
  verifyTenantUpload,
} from "../lib/tenant-store";
import { collectReportData } from "./documents";
import { loadReport } from "./reports";
import { photoOpenUrl } from "../lib/links";
import type { Condition, Cleanliness, ReportType } from "../lib/domain";

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
    const data = await collectReportData(report.id);
    const urls = (roomId?: string, itemId?: string) =>
      data.photos
        .filter((p) => (itemId ? p.itemId === itemId : p.roomId === roomId && !p.itemId))
        .map((p) => photoOpenUrl(p.id) ?? `https://in360view.co.uk/api/photos/${p.id}/open`);
    return createTenantReport(
      {
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
          photoUrls: data.photos
            .filter((p) => !p.roomId && !p.itemId)
            .map((p) => photoOpenUrl(p.id) ?? `https://in360view.co.uk/api/photos/${p.id}/open`),
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
          meters: data.meters.map((m) => ({
            type: m.meterType,
            reading: m.reading,
            serialNumber: m.serialNumber,
            location: m.location,
          })),
          keys: data.keys,
        },
      },
      report.id,
    );
  }),
};
