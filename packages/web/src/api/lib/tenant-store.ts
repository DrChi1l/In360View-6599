import { createHash, randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cleanTenantImage } from "./tenant-image";
import { db } from "../database";
import { tenantReports, tenantAssets, tenantRateLimits } from "../database/schema";
import { deleteObject, getObjectBytes, presignGet, putObject, s3 } from "./s3";
import {
  TENANT_DECLARATION,
  tenantCreateSchema,
  tenantResponseSchema,
  tenantTokenSchema,
  type TenantCreate,
  type TenantResponse,
  type TenantSnapshot,
} from "./tenant-contract";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const emptyResponse: TenantResponse = {
  name: "",
  comments: [],
  photos: [],
  signatureAssetId: null,
};
const MAX_FILE = 8 * 1024 * 1024;
const limitCounters = new Map<string, number>();

export async function tenantLimit(headers: Headers, action: string, max: number, token?: string) {
  // Never rely on caller-provided X-Forwarded-For to grant extra capacity.
  // A global bucket bounds anonymous ingestion; token buckets isolate reviews.
  const hour = Math.floor(Date.now() / 3600000);
  const identity = token ? digest(token) : "anonymous-global";
  const key = `${action}:${identity}:${hour}`;
  const [rate] = await db
    .insert(tenantRateLimits)
    .values({ key, hits: 1, expiresAt: new Date((hour + 2) * 3600000) })
    .onConflictDoUpdate({
      target: tenantRateLimits.key,
      set: { hits: sql`${tenantRateLimits.hits} + 1` },
    })
    .returning();
  if (rate.hits > max)
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Too many requests. Please try again later.",
    });
  // Small in-memory counter only determines when expired persistent rows are swept.
  const count = (limitCounters.get(action) ?? 0) + 1;
  limitCounters.set(action, count);
  if (count % 100 === 0)
    await db.delete(tenantRateLimits).where(lt(tenantRateLimits.expiresAt, new Date()));
  void headers;
}

export async function createTenantReport(input: TenantCreate, sourceReportId?: string) {
  const parsed = tenantCreateSchema.parse(input);
  const snapshot = JSON.stringify(parsed.report);
  if (Buffer.byteLength(snapshot) > 2 * 1024 * 1024)
    throw new ORPCError("BAD_REQUEST", { message: "Report exceeds 2 MB JSON limit." });
  const token = randomBytes(32).toString("base64url");
  await db.insert(tenantReports).values({
    id: randomBytes(16).toString("hex"),
    tokenHash: digest(token),
    sourceReportId,
    snapshot,
    snapshotHash: digest(snapshot),
    response: JSON.stringify(emptyResponse),
  });
  return { token, url: `https://in360view.co.uk/t/${token}` };
}

export async function tenantShare(token: string, editable = false) {
  if (!tenantTokenSchema.safeParse(token).success)
    throw new ORPCError("NOT_FOUND", { message: "This report link is not valid." });
  const [row] = await db
    .select()
    .from(tenantReports)
    .where(eq(tenantReports.tokenHash, digest(token)));
  if (!row) throw new ORPCError("NOT_FOUND", { message: "This report link is not valid." });
  if (editable && row.submittedAt)
    throw new ORPCError("CONFLICT", {
      message: "This response has already been submitted and is locked.",
    });
  return row;
}

export async function getTenantReport(token: string) {
  const share = await tenantShare(token);
  const response = JSON.parse(share.response) as TenantResponse;
  const assets = await db
    .select()
    .from(tenantAssets)
    .where(and(eq(tenantAssets.shareId, share.id), eq(tenantAssets.ready, true)));
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const photoList = await Promise.all(
    response.photos.map(async (p) => ({
      ...p,
      url: assetById.has(p.assetId)
        ? await presignGet(assetById.get(p.assetId)!.storageKey, 900)
        : null,
    })),
  );
  const signature = response.signatureAssetId ? assetById.get(response.signatureAssetId) : null;
  return {
    schemaVersion: 1 as const,
    report: JSON.parse(share.snapshot) as TenantSnapshot,
    tenant: {
      ...response,
      photos: photoList,
      signature: signature
        ? { assetId: signature.id, url: await presignGet(signature.storageKey, 900) }
        : null,
      declaration: share.declaration ?? TENANT_DECLARATION,
      submittedAt: share.submittedAt?.toISOString() ?? null,
    },
    revision: share.revision,
    createdAt: share.createdAt.toISOString(),
    snapshotHash: share.snapshotHash,
    status: share.submittedAt ? ("submitted" as const) : ("open" as const),
  };
}

export async function saveTenantResponse(
  token: string,
  revision: number,
  response: TenantResponse,
  submit = false,
) {
  const share = await tenantShare(token, true);
  const parsed = tenantResponseSchema.parse(response);
  const snapshot = JSON.parse(share.snapshot) as TenantSnapshot;
  const itemIds = new Set(snapshot.rooms.flatMap((r) => r.items.map((i) => i.id)));
  for (const c of [...parsed.comments, ...parsed.photos]) {
    if (c.itemId && !itemIds.has(c.itemId))
      throw new ORPCError("BAD_REQUEST", {
        message: "Comment or photograph references an unknown item.",
      });
  }
  if (new Set(parsed.photos.map((p) => p.assetId)).size !== parsed.photos.length)
    throw new ORPCError("BAD_REQUEST", { message: "Duplicate photograph." });
  const assets = await db
    .select()
    .from(tenantAssets)
    .where(and(eq(tenantAssets.shareId, share.id), eq(tenantAssets.ready, true)));
  for (const p of parsed.photos) {
    if (!assets.some((a) => a.id === p.assetId && a.kind === "photo"))
      throw new ORPCError("BAD_REQUEST", {
        message: "Photograph is not verified for this report.",
      });
  }
  if (
    parsed.signatureAssetId &&
    !assets.some((a) => a.id === parsed.signatureAssetId && a.kind === "signature")
  )
    throw new ORPCError("BAD_REQUEST", { message: "Signature is not verified for this report." });
  if (submit && (!parsed.name.trim() || !parsed.signatureAssetId))
    throw new ORPCError("BAD_REQUEST", {
      message: "Enter your name and draw your signature before submitting.",
    });
  const [updated] = await db
    .update(tenantReports)
    .set({
      response: JSON.stringify(parsed),
      revision: revision + 1,
      ...(submit ? { submittedAt: new Date(), declaration: TENANT_DECLARATION } : {}),
    })
    .where(
      and(
        eq(tenantReports.id, share.id),
        eq(tenantReports.revision, revision),
        isNull(tenantReports.submittedAt),
      ),
    )
    .returning();
  if (!updated)
    throw new ORPCError("CONFLICT", {
      message: "The response changed in another tab. Reload before saving to avoid overwriting it.",
    });
  return { revision: updated.revision, submittedAt: updated.submittedAt?.toISOString() ?? null };
}

export async function reserveTenantUpload(
  token: string,
  kind: "photo" | "signature",
  contentType: string,
  bytes: number,
) {
  const share = await tenantShare(token, true);
  if (bytes < 1 || bytes > MAX_FILE)
    throw new ORPCError("BAD_REQUEST", { message: "Each image must be smaller than 8 MB." });
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
    (kind === "signature" && contentType !== "image/png")
  )
    throw new ORPCError("BAD_REQUEST", {
      message: "Use JPEG, PNG or WebP photographs and PNG signatures.",
    });
  const id = randomBytes(16).toString("hex");
  const storageKey = `tenant-reports/${share.id}/pending/${id}`;
  // Reserve atomically so concurrent requests cannot bypass the lifetime cap or final lock.
  const result =
    await db.execute(sql`INSERT INTO tenant_assets (id, share_id, kind, content_type, storage_key, ready, created_at)
    SELECT ${id}, ${share.id}, ${kind}, ${contentType}, ${storageKey}, false, ${new Date()}
    WHERE EXISTS (SELECT 1 FROM tenant_reports WHERE id = ${share.id} AND submitted_at IS NULL)
      AND (SELECT count(*) FROM tenant_assets WHERE share_id = ${share.id}) < 40
    RETURNING id`);
  if (!result.length)
    throw new ORPCError("CONFLICT", {
      message: "The response is locked or its upload limit has been reached.",
    });
  // Sign the exact content length as well as the object key. Oversized uploads
  // are rejected by storage itself, not merely after they have incurred costs.
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
      ContentType: contentType,
      ContentLength: bytes,
    }),
    { expiresIn: 300, signableHeaders: new Set(["content-length"]) },
  );
  return { assetId: id, url, maxBytes: MAX_FILE };
}

export async function verifyTenantUpload(token: string, assetId: string) {
  const share = await tenantShare(token, true);
  const [asset] = await db
    .select()
    .from(tenantAssets)
    .where(and(eq(tenantAssets.id, assetId), eq(tenantAssets.shareId, share.id)));
  if (!asset) throw new ORPCError("NOT_FOUND", { message: "Upload not found." });
  if (asset.ready) return { assetId, url: await presignGet(asset.storageKey, 900) };
  if (Date.now() - asset.createdAt.getTime() > 10 * 60000)
    throw new ORPCError("BAD_REQUEST", { message: "Upload expired. Please upload again." });
  let size = 0;
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.storageKey }),
    );
    size = head.ContentLength ?? 0;
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "The image has not finished uploading." });
  }
  if (size < 1 || size > MAX_FILE) {
    await deleteObject(asset.storageKey);
    throw new ORPCError("BAD_REQUEST", { message: "Image exceeds 8 MB limit." });
  }
  const bytes = await getObjectBytes(asset.storageKey);
  if (!bytes) throw new ORPCError("BAD_REQUEST", { message: "Could not read uploaded image." });
  let cleaned: Buffer;
  try {
    cleaned = await cleanTenantImage(Buffer.from(bytes), asset.kind as "photo" | "signature");
  } catch {
    await deleteObject(asset.storageKey);
    throw new ORPCError("BAD_REQUEST", {
      message: "Upload a valid image; signatures cannot be blank.",
    });
  }
  const key = `tenant-reports/${share.id}/verified/${asset.id}.${asset.kind === "signature" ? "png" : "jpg"}`;
  await putObject(key, cleaned, asset.kind === "signature" ? "image/png" : "image/jpeg");
  await db
    .update(tenantAssets)
    .set({ ready: true, storageKey: key })
    .where(eq(tenantAssets.id, asset.id));
  await deleteObject(asset.storageKey);
  return { assetId, url: await presignGet(key, 900) };
}
