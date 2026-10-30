import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { auth } from "./auth";
import { account } from "./routes/account";
import { addresses } from "./routes/addresses";
import { bookings } from "./routes/bookings";
import { dashboard } from "./routes/dashboard";
import { documents } from "./routes/documents";
import { inspection } from "./routes/inspection";
import { myBookings } from "./routes/my-bookings";
import { photoOpen } from "./routes/photo-open";
import { photos } from "./routes/photos";
import { ping } from "./routes/ping";
import { properties } from "./routes/properties";
import { reports } from "./routes/reports";
import { search } from "./routes/search";
import { signatures } from "./routes/signatures";
import { ingestTenantReport, streamTenantReport, tenantReport } from "./routes/tenant-report";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
export const router = {
  ping,
  account,
  dashboard,
  bookings,
  myBookings,
  addresses,
  properties,
  reports,
  inspection,
  photos,
  signatures,
  documents,
  search,
  tenantReport,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);

app.post("/api/tenant-report", ingestTenantReport);
app.get("/api/tenant-report/:token", streamTenantReport);

// Photograph links inside downloaded report PDFs — redirects to a freshly
// presigned storage URL so the link never expires.
app.get("/api/photos/:id/open", photoOpen);

// Better Auth owns every /api/auth/* route (email+password, Google, Apple, Expo).
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export default app;
