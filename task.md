## Tenant report links — approved build

- Public snapshot ingestion POST /api/tenant-report, public JSON stream GET /api/tenant-report/:token.
- Typed anonymous oRPC procedures for review, uploads, draft save and final submission.
- Token-only access; original immutable, tenant response separate; one response per link.
- Persist throttling and upload reservations. Validate uploads, strip metadata, store in Tigris.
- Public /t/:token page; staff share button and mobile integration helper.
- Verify API happy path, invalid payload/token, draft conflict, signed lock and uploads, then browser, build, lint.
- Canonical returned URL uses in360view.co.uk as requested; custom domain publishing is platform-managed.
- No tenant identity verification: signature proves submission from link holder, not authenticated identity.
 
## Verified handover — 7 October 2026

- [x] Public POST and GET; database-backed immutable snapshots and separate responses.
- [x] Anonymous tenant comments, verified photographs, signature, draft save and final lock.
- [x] Staff completed-report sharing control; API guide and example payload packaged.
- [x] API integration test: 1 pass, 0 fail, 34 assertions, including cross-token isolation, duplicate IDs, body limit, blank signatures, conflicts and final locks.
- [x] Chrome E2E at 390px: photo/signature upload, draft reload, submission, disabled final controls, no overflow or page errors. Desktop rendering and invalid-link screen checked.
- [x] Explicit web app TypeScript check clean; production build and project lint pass. Build retains a bundle-size warning.
- [x] Running local and external preview health endpoint verified.
- [ ] Publish/custom domain in platform UI; canonical production-domain reachability not verified.
- [ ] Wire the separate native inspection app's completion flow and local token persistence. Supplied mobile client is an integration example, not a completed native screen.
- [ ] Staff link recovery/history is not implemented; keep generated links before leaving the report page.

## Publish crash fix — 7 October 2026

- Removed the server's Sharp import: native libvips cannot initialise correctly inside this standalone release bundle (`format.jp2k.output` crash).
- Tenant uploads now decode/re-encode with portable jpeg-js/pngjs and the WebP WASM decoder shipped in public/wasm. Sharp remains a development-only build/test dependency.
- Retained JPEG/PNG/WebP support, image size checks, metadata stripping, EXIF orientation, resizing and blank/invisible signature rejection.
- Verified a minified standalone server bundle built and run with Bun 1.3.14 Linux x64 baseline, isolated outside the project without node_modules. Health returns 200, static decoder asset is served, actual upload/draft/submission tests pass. Bundle source map confirms no Sharp modules.
- Regression checks: 4 tests pass, 58 assertions; explicit app TypeScript, build and lint clean (existing bundle-size warning only).
- Republish through platform UI is still needed; live Fly rollout has not been performed here.