import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { loadLogoBytes, loadLogoLightBytes } from "../lib/brand";
import { newId } from "../lib/ids";
import { buildReportPdf, type PdfReportData } from "../lib/pdf";
import { presignGet, putObject } from "../lib/s3";
import { authed } from "../middleware/auth";
import { loadReport } from "./reports";

/** Collects everything the PDF builder needs for one report. */
export async function collectReportData(reportId: string): Promise<PdfReportData> {
  const [report] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId));
  const [property] = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.id, report.propertyId));

  const roomRows = await db
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.reportId, reportId))
    .orderBy(schema.rooms.sortOrder);
  const itemRows = await db
    .select()
    .from(schema.items)
    .where(eq(schema.items.reportId, reportId))
    .orderBy(schema.items.sortOrder);
  const photoRows = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.reportId, reportId))
    .orderBy(schema.photos.sortOrder);
  const signatureRows = await db
    .select()
    .from(schema.signatures)
    .where(eq(schema.signatures.reportId, reportId));
  const meters = await db
    .select()
    .from(schema.meterReadings)
    .where(eq(schema.meterReadings.reportId, reportId));
  const keys = await db.select().from(schema.keySets).where(eq(schema.keySets.reportId, reportId));

  let previousItems: PdfReportData["previousItems"] = {};
  if (report.baseReportId) {
    const baseItems = await db
      .select()
      .from(schema.items)
      .where(eq(schema.items.reportId, report.baseReportId));
    previousItems = Object.fromEntries(
      baseItems.map((i) => [
        i.id,
        { condition: i.condition, cleanliness: i.cleanliness, description: i.description },
      ]),
    );
  }

  return {
    report,
    property,
    rooms: roomRows.map((room) => ({
      id: room.id,
      name: room.name,
      condition: room.condition,
      cleanliness: room.cleanliness,
      notes: room.notes,
      items: itemRows.filter((i) => i.roomId === room.id),
    })),
    photos: photoRows.map((p) => ({
      id: p.id,
      roomId: p.roomId,
      itemId: p.itemId,
      caption: p.caption,
      storageKey: p.storageKey,
      thumbKey: p.thumbKey,
    })),
    signatures: signatureRows,
    meters,
    keys,
    previousItems,
    logoBytes: await loadLogoBytes(),
    logoLightBytes: await loadLogoLightBytes(),
  };
}

export const documents = {
  /** Renders (or re-renders) the report PDF, stores it and returns a signed URL. */
  generate: authed.input(z.object({ reportId: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.reportId, context.user.id, context.user.role);
    const data = await collectReportData(report.id);
    const bytes = await buildReportPdf(data);

    const key = `properties/${report.propertyId}/reports/${report.id}/${report.reference ?? report.id}.pdf`;
    await putObject(key, bytes, "application/pdf");
    const generatedAt = new Date();
    await db
      .update(schema.reports)
      .set({ pdfKey: key, pdfGeneratedAt: generatedAt, updatedAt: generatedAt })
      .where(eq(schema.reports.id, report.id));
    await db.insert(schema.auditLog).values({
      id: newId("aud"),
      userId: context.user.id,
      entityType: "report",
      entityId: report.id,
      action: "pdf_generated",
    });

    return {
      key,
      url: await presignGet(key),
      generatedAt,
      sizeBytes: bytes.byteLength,
    };
  }),

  /** The current PDF, if one has been generated. */
  url: authed.input(z.object({ reportId: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.reportId, context.user.id, context.user.role);
    if (!report.pdfKey) return { url: null, generatedAt: null };
    return { url: await presignGet(report.pdfKey), generatedAt: report.pdfGeneratedAt };
  }),

  /** Emails the report PDF to the landlord, tenant or any other address. */
  email: authed
    .input(
      z.object({
        reportId: z.string(),
        to: z.array(z.string().email()).min(1).max(5),
        message: z.string().max(2000).optional().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const report = await loadReport(input.reportId, context.user.id, context.user.role);
      const [property] = await db
        .select()
        .from(schema.properties)
        .where(eq(schema.properties.id, report.propertyId));

      let key = report.pdfKey;
      if (!key) {
        const data = await collectReportData(report.id);
        const bytes = await buildReportPdf(data);
        key = `properties/${report.propertyId}/reports/${report.id}/${report.reference ?? report.id}.pdf`;
        await putObject(key, bytes, "application/pdf");
        await db
          .update(schema.reports)
          .set({ pdfKey: key, pdfGeneratedAt: new Date() })
          .where(eq(schema.reports.id, report.id));
      }

      const url = await presignGet(key, 60 * 60 * 24 * 7);
      const address = [property.addressLine1, property.city, property.postcode].filter(Boolean).join(", ");
      const typeLabel =
        report.type === "check_in" ? "Check-In" : report.type === "check_out" ? "Check-Out" : "Mid-Term";
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new ORPCError("PRECONDITION_FAILED", { message: "Email is not configured yet." });

      const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#141220;line-height:1.6">
  <p style="margin:0 0 16px">Hello,</p>
  <p style="margin:0 0 16px">Please find the ${typeLabel} inventory report for <strong>${address}</strong> attached below.</p>
  ${input.message ? `<p style="margin:0 0 16px;white-space:pre-wrap">${input.message}</p>` : ""}
  <p style="margin:0 0 24px"><a href="${url}" style="background:#12065C;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Download the report (PDF)</a></p>
  <p style="margin:0 0 4px;font-size:13px;color:#5C5A6B">Report reference: ${report.reference ?? report.id}</p>
  <p style="margin:0;font-size:13px;color:#5C5A6B">${context.user.name} &middot; In360View &middot; Inventories, Inspections, Reports</p>
</div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? "In360View <onboarding@resend.dev>",
          to: input.to,
          reply_to: context.user.email,
          subject: `${typeLabel} report — ${address}`,
          html,
        }),
      });
      if (!res.ok) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: `Email failed: ${await res.text()}` });
      }

      await db.insert(schema.auditLog).values({
        id: newId("aud"),
        userId: context.user.id,
        entityType: "report",
        entityId: report.id,
        action: "emailed",
        detail: input.to.join(", "),
      });
      return { ok: true, sentTo: input.to };
    }),
};
