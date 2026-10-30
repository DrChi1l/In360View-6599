 # In360View tenant report integration

The public API and tenant review page are implemented. An app publishes a versioned report snapshot, keeps the returned token, and shares the URL. The tenant can save a draft, add comments and photographs, and sign a final response without an account. Final submission locks the response; it never changes the original report snapshot.

## Publish from the app

Send `POST /api/tenant-report` with `Content-Type: application/json` and the example JSON supplied alongside this guide. A successful request returns HTTP **201**:

```json
{ "token": "43-character-random-token", "url": "https://in360view.co.uk/t/TOKEN" }
```

Save both values in the app's local report record **before** opening the device share sheet. The server only stores the token's hash and cannot recover a lost token. A new POST creates a new independent snapshot and review; do not automatically retry an uncertain publication without checking whether the app already received a link.

### Snapshot contract

Required outer fields: `schemaVersion: 1`, `report`.

Required report fields: `reference`, `type`, `inspectionDate` (`YYYY-MM-DD`), `inspectorName`, `property` (`address`, `postcode`), `rooms`.

- Type: `check_in`, `check_out`, `mid_term`.
- Room: unique `id`, `name`, `items`; optional `notes`, `photoUrls`.
- Item: globally unique `id`, `name`; optional `quantity` (default 1), `description`, `notes`, `condition`, `cleanliness`, `photoUrls`.
- Conditions: `excellent`, `good`, `fair`, `poor`, `damaged`, `na`; nullable.
- Cleanliness: `clean`, `generally_clean`, `fair`, `poor`, `very_poor`, `na`; nullable.
- Optional report fields: `summary`, `photoUrls` (property/general photographs), `meters`, `keys`.
- Meter: `type`; optional `serialNumber`, `reading`, `location`.
- Key: `description`, `quantity`; optional `notes`.

Use stable HTTPS photograph URLs accessible without signing in. Local device paths do not work. Short-lived presigned URLs embedded in the snapshot will expire; upload original photographs first and provide durable links. The staff shortcut uses the existing photo-open redirect addresses.

Maximum JSON request size: **2 MiB**. Maximum 100 rooms, 300 items per room, 3,000 items total, and 100 photograph URLs per photograph list. Unknown object fields are not part of the stored contract; map important app data into the defined fields.

## Retrieve the tenant response

`GET /api/tenant-report/TOKEN` returns HTTP **200**, raw JSON and `Cache-Control: no-store`:

```text
schemaVersion: 1
report: original snapshot
tenant:
  name
  comments: [{ itemId: string | null, text }]
  photos: [{ assetId, itemId: string | null, caption, url }]
  signatureAssetId: string | null
  signature: { assetId, url } | null
  declaration
  submittedAt: ISO timestamp | null
revision: integer
createdAt: ISO timestamp
snapshotHash: SHA-256 hex digest of the stored snapshot
status: "open" | "submitted"
```

`itemId: null` means a general observation or photograph. Tenant photograph and signature URLs last **15 minutes**; fetch the report again to refresh them. The hash identifies the stored normalised snapshot, not the original request bytes. `submittedAt` and declaration are also retained with the final response.

## Tenant actions

The website already performs these actions. Additional app clients should use the typed oRPC client connected to `/api/rpc` rather than hand-crafting RPC envelopes:

| Procedure | Input / result |
|---|---|
| `tenantReport.create` | Same publication object; returns `{ token, url }` |
| `tenantReport.get` | `{ token }`; same data as public GET |
| `tenantReport.save` | `{ token, revision, response }`; returns new `revision` and `submittedAt` |
| `tenantReport.submit` | Same input plus `accepted: true`; requires full name and verified signature |
| `tenantReport.upload` | `{ token, kind, contentType, bytes }`; returns `{ assetId, url, maxBytes }` |
| `tenantReport.verifyUpload` | `{ token, assetId }`; returns verified `{ assetId, url }` |

`response` contains `name`, `comments`, `photos` (**without** their URL fields), and `signatureAssetId`. Use the last retrieved revision. A conflict means another tab changed the response; reload and reconcile rather than overwriting it.

Upload sequence: reserve → PUT the exact file bytes to the returned storage URL with the matching content type → verify → attach the returned asset ID to the response → save. Photographs accept JPEG, PNG or WebP; signatures require PNG. Each file is limited to **8 MiB**, with 20 attached photographs and 40 lifetime upload reservations per report link. Reservation URLs last five minutes. Images are decoded, resized and re-encoded without metadata before they can be attached. Invalid and blank signature images are rejected. An uploaded image is not attached until the response is saved.

`tenantReport.publish({ reportId })` is an authenticated staff shortcut for completed inspections. Its **Send to tenant** control is on the existing report-detail page. Save the generated link outside the page before leaving; the current staff control does not recover earlier links after a reload.

## Errors and privacy

Public POST: 400 invalid JSON/schema, 413 request too large, 415 unsupported content type, 429 rate limit, 500 server failure. GET: 404 invalid/missing link, 429 rate limit, 500 server failure. RPC actions additionally use `BAD_REQUEST`, `NOT_FOUND`, `CONFLICT` and `TOO_MANY_REQUESTS` errors.

Publication is anonymous as requested, limited to 60 creations per hour globally. Reviews have per-token hourly limits: 240 reads, 120 writes, 40 upload reservations and 80 verifications. Final responses cannot be saved or given new upload reservations.

The token is a bearer credential: anyone with it can view the report and edit an open response. Share it only with the intended recipient. No identity verification, token revocation, expiry policy or automatic reminder email is included. A drawn signature records the link holder's submission; it does not independently establish identity. Search-index exclusion is not access control.

## Handover / publishing

- Website/API: implemented; database tables provisioned in the current managed environment.
- Use the platform's Publish controls and custom-domain settings for `in360view.co.uk`. Returned URLs always use that requested domain; domain publication has not been verified in this build.
- Preview testing: replace only the returned URL's origin with the website preview origin, retaining `/t/TOKEN`.
- Native app: the separate inspection app screens are not built/wired in this feature. The supplied TypeScript sample shows anonymous publication, sharing and reading; copy it to the documented mobile path and connect it to the app's completion flow, persisting the token locally.
- Implementation authority: `packages/web/src/api/lib/tenant-contract.ts`, `tenant-store.ts`, `routes/tenant-report.ts`, and `packages/web/tests/tenant-report.test.ts` in this project.