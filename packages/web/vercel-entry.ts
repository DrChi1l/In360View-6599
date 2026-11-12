// Source of the Vercel serverless function. Do not deploy this file directly:
// `node build-tools/bundle-api.mjs` bundles it (with everything under ./src) into api/index.js.
//
// Why: Vercel runs the function as plain Node ES modules, which refuse imports without a
// file extension (e.g. "../src/api"). Bundling resolves all of them at build time.
import { handle } from "hono/vercel";
import app from "./src/api";

export default handle(app);
