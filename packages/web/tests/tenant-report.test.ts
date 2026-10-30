import { test, expect } from "bun:test";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import type { AppRouterClient } from "../src/api";

const base = "http://localhost:4200";
const client: AppRouterClient = createORPCClient(new RPCLink({ url: `${base}/api/rpc` }));
const payload = {
  schemaVersion: 1,
  report: {
    reference: `TEST-${Date.now()}`,
    type: "check_in",
    inspectionDate: "2026-10-06",
    inspectorName: "Sample inspector",
    property: { address: "12 Example Lane", postcode: "AB1 2CD" },
    summary: "Sample report for testing tenant review. No real tenancy data.",
    rooms: [
      {
        id: "hall",
        name: "Entrance hallway",
        photoUrls: [],
        items: [
          {
            id: "door",
            name: "Front door",
            description: "White painted timber door with chrome handle.",
            condition: "good",
            cleanliness: "clean",
            notes: "Light scuff to the lower edge.",
            photoUrls: [],
          },
        ],
      },
    ],
    meters: [
      {
        type: "electricity",
        serialNumber: "SAMPLE-001",
        reading: "12345",
        location: "Hall cupboard",
      },
    ],
    keys: [{ description: "Front door keys", quantity: 2 }],
  },
};

test("public endpoints, validation, uploads, drafts, conflicts, signature and immutable submission", async () => {
  const invalid = await fetch(`${base}/api/tenant-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  expect(invalid.status).toBe(400);
  expect((await fetch(`${base}/api/tenant-report/not-a-token`)).status).toBe(404);
  expect((await fetch(`${base}/api/tenant-report/${"a".repeat(43)}`)).status).toBe(404);
  const duplicate = structuredClone(payload);
  duplicate.report.rooms[0].items.push(duplicate.report.rooms[0].items[0]);
  expect(
    (
      await fetch(`${base}/api/tenant-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(duplicate),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await fetch(`${base}/api/tenant-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(2 * 1024 * 1024 + 1),
      })
    ).status,
  ).toBe(413);
  const posted = await fetch(`${base}/api/tenant-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  expect(posted.status).toBe(201);
  const { token, url } = (await posted.json()) as { token: string; url: string };
  expect(token).toHaveLength(43);
  expect(url).toBe(`https://in360view.co.uk/t/${token}`);
  const get = await fetch(`${base}/api/tenant-report/${token}`);
  expect(get.status).toBe(200);
  expect(get.headers.get("cache-control")).toBe("no-store");
  const before = await get.json();
  expect(before.report.reference).toBe(payload.report.reference);
  expect(before.report.photoUrls).toEqual([]);
  expect(before.status).toBe("open");

  let draft = {
    name: "Sample Tenant",
    comments: [{ itemId: "door", text: "There is a second small mark near the lock." }],
    photos: [] as { assetId: string; itemId: string | null; caption: string }[],
    signatureAssetId: null as string | null,
  };
  const saved = await client.tenantReport.save({ token, revision: 0, response: draft });
  expect(saved.revision).toBe(1);
  await expect(client.tenantReport.save({ token, revision: 0, response: draft })).rejects.toThrow(
    "another tab",
  );
  await expect(
    client.tenantReport.save({
      token,
      revision: 1,
      response: { ...draft, comments: [{ itemId: "unknown", text: "Invalid target" }] },
    }),
  ).rejects.toThrow("unknown item");
  await expect(
    client.tenantReport.submit({ token, revision: 1, response: draft, accepted: true }),
  ).rejects.toThrow("signature");

  const photo = await sharp({
    create: { width: 320, height: 240, channels: 3, background: "#dad7e8" },
  })
    .jpeg()
    .toBuffer();
  async function upload(
    data: Buffer,
    kind: "photo" | "signature",
    contentType: "image/jpeg" | "image/png" | "image/webp",
  ) {
    const slot = await client.tenantReport.upload({ token, kind, contentType, bytes: data.length });
    const put = await fetch(slot.url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: data,
    });
    expect(put.ok).toBe(true);
    return client.tenantReport.verifyUpload({ token, assetId: slot.assetId });
  }
  const asset = await upload(photo, "photo", "image/jpeg");
  const imageGet = await fetch(asset.url);
  expect(imageGet.status).toBe(200);
  const webp = await sharp(photo).webp().toBuffer();
  const webpAsset = await upload(webp, "photo", "image/webp");
  const webpResult = await fetch(webpAsset.url);
  expect(webpResult.status).toBe(200);
  expect((await sharp(Buffer.from(await webpResult.arrayBuffer())).metadata()).format).toBe("jpeg");
  draft = {
    ...draft,
    photos: [{ assetId: asset.assetId, itemId: "door", caption: "Small mark near lock" }],
  };
  const sig = await sharp(
    Buffer.from(
      '<svg width="500" height="150" xmlns="http://www.w3.org/2000/svg"><path d="M30 110 Q50 20 85 85 T160 75 Q190 130 230 70 T320 90 L440 65" stroke="#12065C" stroke-width="4" fill="none"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const signature = await upload(sig, "signature", "image/png");
  draft.signatureAssetId = signature.assetId;
  const other = await client.tenantReport.create({ schemaVersion: 1, report: before.report });
  await expect(
    client.tenantReport.save({ token: other.token, revision: 0, response: draft }),
  ).rejects.toThrow("not verified");
  await expect(
    client.tenantReport.verifyUpload({ token: other.token, assetId: asset.assetId }),
  ).rejects.toThrow("not found");
  const blank = await sharp({
    create: { width: 200, height: 100, channels: 4, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  await expect(upload(blank, "signature", "image/png")).rejects.toThrow("cannot be blank");
  const invalidSlot = await client.tenantReport.upload({
    token,
    kind: "photo",
    contentType: "image/jpeg",
    bytes: 4,
  });
  await fetch(invalidSlot.url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: "oops",
  });
  await expect(
    client.tenantReport.verifyUpload({ token, assetId: invalidSlot.assetId }),
  ).rejects.toThrow("valid image");
  const signed = await client.tenantReport.submit({
    token,
    revision: 1,
    response: draft,
    accepted: true,
  });
  expect(signed.submittedAt).not.toBeNull();
  const after = await (await fetch(`${base}/api/tenant-report/${token}`)).json();
  expect(after.status).toBe("submitted");
  expect(after.tenant.comments[0].text).toBe(draft.comments[0].text);
  expect(after.tenant.photos).toHaveLength(1);
  expect(after.tenant.signature.url).toContain("https://");
  expect(after.snapshotHash).toBe(before.snapshotHash);
  expect(after.report).toEqual(before.report);
  await expect(client.tenantReport.save({ token, revision: 2, response: draft })).rejects.toThrow(
    "locked",
  );
  await expect(
    client.tenantReport.upload({ token, kind: "photo", contentType: "image/jpeg", bytes: 30 }),
  ).rejects.toThrow("locked");
  const demo = await fetch(`${base}/api/tenant-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      report: { ...payload.report, reference: "SAMPLE-TENANT-REVIEW" },
    }),
  });
  const demoShare = await demo.json();
  await writeFile(
    "/home/user/in360view/tenant-demo.json",
    JSON.stringify({ open: demoShare, submitted: { token, url } }),
  );
}, 90000);
