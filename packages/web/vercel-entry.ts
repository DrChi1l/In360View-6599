// Source of the Vercel serverless function. Do not deploy this file directly:
// `node build-tools/bundle-api.mjs` bundles it (with everything under ./src) into api/index.js.
//
// Why bundle: Vercel runs the function as plain Node ES modules, which refuse imports
// without a file extension (e.g. "./src/api"). Bundling resolves all of them at build time.
//
// Why `{ fetch }`: Vercel's Node runtime treats a default-exported *function* as a legacy
// (req, res) handler, so a Web-standard handler such as hono/vercel's `handle(app)` never
// gets a Request and the call hangs. An object with `fetch` is the Web-standard form.
import app from "./src/api";

export default {
  fetch: (request: Request) => app.fetch(request),
};
