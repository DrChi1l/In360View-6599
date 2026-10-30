/**
 * Transactional email, sent server-side through Resend's HTTP API.
 *
 * Nothing here throws at the caller by default: a booking must still be saved
 * even if the mail provider is down or unconfigured, so `notify()` swallows
 * failures and logs them instead. Use `sendEmail()` when the caller needs to
 * know whether the message went out.
 */

const FALLBACK_FROM = "In360View <onboarding@resend.dev>";

/** Where booking and service requests are announced. */
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL?.trim() || "in360view@outlook.com";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /** Base64 `content`, e.g. a calendar invite. */
  attachments?: { filename: string; content: string; contentType?: string }[];
};

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail({ to, subject, html, text, replyTo, attachments }: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("Email is not configured yet (RESEND_API_KEY is missing).");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL?.trim() || FALLBACK_FROM,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo,
      subject,
      html,
      text,
      attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content, content_type: a.contentType })),
    }),
  });
  if (!res.ok) throw new Error(`Email failed: ${await res.text()}`);
  return (await res.json()) as { id?: string };
}

/** Fire-and-forget: never lets an email problem break the request that sent it. */
export async function notify(options: SendEmailOptions) {
  if (!emailConfigured()) {
    console.warn(`[email] skipped "${options.subject}" — RESEND_API_KEY is not set.`);
    return { sent: false as const, reason: "not-configured" as const };
  }
  try {
    await sendEmail(options);
    return { sent: true as const };
  } catch (error) {
    console.error(`[email] failed to send "${options.subject}"`, error);
    return { sent: false as const, reason: "failed" as const };
  }
}

/** Shared shell so every notification looks like it came from the same place. */
export function emailShell(title: string, bodyHtml: string) {
  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#141220;line-height:1.6;max-width:620px">
  <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5C5A6B">In360View</p>
  <h1 style="margin:0 0 16px;font-size:20px;color:#12065C">${title}</h1>
  ${bodyHtml}
  <p style="margin:24px 0 0;font-size:12px;color:#5C5A6B">In360View &middot; Inventories, Inspections, Reports</p>
</div>`;
}

export function detailRows(rows: [string, string | null | undefined][]) {
  const cells = rows
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:#5C5A6B;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:14px;color:#141220"><strong>${escapeHtml(String(value))}</strong></td></tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;margin:0 0 20px">${cells}</table>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
