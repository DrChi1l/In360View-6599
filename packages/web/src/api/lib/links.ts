/**
 * Absolute, permanent links into the app. Used where a URL has to survive
 * outside the browser session — inside a downloaded PDF, in an email — so a
 * short-lived presigned storage URL will not do.
 */

function siteBase() {
  const base = process.env.WEBSITE_URL ?? "";
  return base.replace(/\/+$/, "");
}

/**
 * Opens the full-resolution photograph in the browser. The route redirects to
 * a freshly presigned storage URL on every request, so the link keeps working
 * however long after the PDF was produced it is clicked.
 */
export function photoOpenUrl(photoId: string): string | null {
  const base = siteBase();
  return base ? `${base}/api/photos/${photoId}/open` : null;
}
