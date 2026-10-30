import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { newId } from "../lib/ids";
import { deleteObject, presignGet, putObject } from "../lib/s3";
import { authed } from "../middleware/auth";
import { assertEditable, loadReport } from "./reports";

const SIGNER_ROLES = ["clerk", "tenant", "landlord", "agent"] as const;

/** Strips the data-URL prefix and decodes a base64 signature PNG. */
function decodeSignature(dataUrl: string) {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const binary = Buffer.from(base64, "base64");
  if (!binary.length) throw new ORPCError("BAD_REQUEST", { message: "Signature image is empty" });
  if (binary.length > 2_000_000) throw new ORPCError("BAD_REQUEST", { message: "Signature image is too large" });
  return new Uint8Array(binary);
}

export const signatures = {
  list: authed.input(z.object({ reportId: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.reportId, context.user.id, context.user.role);
    const rows = await db
      .select()
      .from(schema.signatures)
      .where(eq(schema.signatures.reportId, report.id));
    return Promise.all(rows.map(async (s) => ({ ...s, url: await presignGet(s.storageKey) })));
  }),

  /**
   * Captures one party's signature. The PNG comes in as a data URL from the
   * signature pad — small enough to post directly, unlike inspection photos.
   */
  create: authed
    .input(
      z.object({
        reportId: z.string(),
        signerRole: z.enum(SIGNER_ROLES),
        signerName: z.string().min(1).max(160),
        signerEmail: z.string().email().optional().nullable(),
        statement: z.string().max(1000).optional().nullable(),
        /** base64 PNG, with or without the `data:image/png;base64,` prefix. */
        imageBase64: z.string().min(32),
      }),
    )
    .handler(async ({ input, context }) => {
      const report = await loadReport(input.reportId, context.user.id, context.user.role);
      if (report.lockedAt) {
        throw new ORPCError("CONFLICT", { message: "This report is locked and cannot be signed again." });
      }

      const bytes = decodeSignature(input.imageBase64);
      const id = newId("sig");
      const key = `properties/${report.propertyId}/reports/${report.id}/signatures/${id}.png`;
      await putObject(key, bytes, "image/png");

      // One signature per role — a re-sign replaces the previous one.
      const existing = await db
        .select()
        .from(schema.signatures)
        .where(eq(schema.signatures.reportId, report.id));
      const previous = existing.find((s) => s.signerRole === input.signerRole);
      if (previous) {
        await db.delete(schema.signatures).where(eq(schema.signatures.id, previous.id));
        await deleteObject(previous.storageKey);
      }

      await db.insert(schema.signatures).values({
        id,
        reportId: report.id,
        signerRole: input.signerRole,
        signerName: input.signerName,
        signerEmail: input.signerEmail ?? null,
        storageKey: key,
        statement:
          input.statement ??
          "I confirm that I have read this report and agree that it is an accurate record of the condition of the property on the date stated.",
      });

      await db.insert(schema.auditLog).values({
        id: newId("aud"),
        userId: context.user.id,
        entityType: "report",
        entityId: report.id,
        action: "signed",
        detail: `${input.signerRole}: ${input.signerName}`,
      });

      await db.update(schema.reports).set({ updatedAt: new Date() }).where(eq(schema.reports.id, report.id));
      const [row] = await db.select().from(schema.signatures).where(eq(schema.signatures.id, id));
      return { ...row, url: await presignGet(row.storageKey) };
    }),

  remove: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [row] = await db.select().from(schema.signatures).where(eq(schema.signatures.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND");
    const report = await loadReport(row.reportId, context.user.id, context.user.role);
    assertEditable(report);
    await db.delete(schema.signatures).where(eq(schema.signatures.id, input.id));
    await deleteObject(row.storageKey);
    return { ok: true };
  }),

  /**
   * Finalises a report: status becomes `signed` and `lockedAt` is stamped, after
   * which every mutation on the report, its rooms, items and photos is refused.
   */
  finalise: authed.input(z.object({ reportId: z.string() })).handler(async ({ input, context }) => {
    const report = await loadReport(input.reportId, context.user.id, context.user.role);
    if (report.lockedAt) return report;
    const signed = await db
      .select()
      .from(schema.signatures)
      .where(eq(schema.signatures.reportId, report.id));
    if (!signed.length) {
      throw new ORPCError("BAD_REQUEST", { message: "At least one signature is required before locking." });
    }
    const [row] = await db
      .update(schema.reports)
      .set({
        status: "signed",
        lockedAt: new Date(),
        completedAt: report.completedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.reports.id, report.id))
      .returning();
    await db.insert(schema.auditLog).values({
      id: newId("aud"),
      userId: context.user.id,
      entityType: "report",
      entityId: report.id,
      action: "locked",
      detail: `${signed.length} signature(s)`,
    });
    return row;
  }),
};
