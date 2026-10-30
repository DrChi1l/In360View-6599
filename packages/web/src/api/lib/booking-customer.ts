/**
 * Everything the person who booked sees: the emails they receive (request
 * received → booked in → or declined) and the private "My bookings" link.
 *
 * People who book have no account. Instead, each email carries a link holding
 * a random token; only its SHA-256 digest is stored, it expires, and it shows
 * the bookings made with that one email address — nothing the office writes
 * internally.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { roomsSummary } from "./booking-rooms";
import { NOTIFY_EMAIL, detailRows, emailShell, escapeHtml, notify } from "./email";
import { newId } from "./ids";

export type BookingRow = typeof schema.bookingRequests.$inferSelect;
type Lang = "en" | "es";

export const CANONICAL_ORIGIN = "https://in360view.co.uk";
/** How long an emailed "My bookings" link keeps working. */
export const LINK_DAYS = 60;
const OFFICE_PHONE = { en: "07990 060618", es: "+44 7990 060618" };

const digest = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * The site the link in an email should point at. Only known origins are
 * trusted — otherwise a forged Origin header could make us email someone a
 * valid link on a stranger's domain.
 */
export function siteOrigin(headers?: Headers) {
  const allowed = new Set([CANONICAL_ORIGIN, "https://www.in360view.co.uk"]);
  try {
    if (process.env.WEBSITE_URL) allowed.add(new URL(process.env.WEBSITE_URL).origin);
  } catch {
    // Malformed WEBSITE_URL — fall back to the canonical site.
  }
  const origin = headers?.get("origin")?.replace(/\/+$/, "");
  if (origin && (allowed.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))) return origin;
  return CANONICAL_ORIGIN;
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export async function issueBookingLink(email: string, origin: string) {
  const token = randomBytes(24).toString("base64url");
  await db.insert(schema.bookingAccessLinks).values({
    id: newId("bal"),
    tokenHash: digest(token),
    email: normaliseEmail(email),
    expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000),
  });
  // Opportunistic sweep so expired links don't pile up.
  void db
    .delete(schema.bookingAccessLinks)
    .where(lt(schema.bookingAccessLinks.expiresAt, new Date()))
    .catch(() => {});
  return `${origin}/my-bookings/${token}`;
}

/** The email address a link belongs to, or null if it is unknown or expired. */
export async function emailForToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [link] = await db
    .select()
    .from(schema.bookingAccessLinks)
    .where(and(eq(schema.bookingAccessLinks.tokenHash, digest(token)), gt(schema.bookingAccessLinks.expiresAt, new Date())));
  return link?.email ?? null;
}

export async function bookingsForEmail(email: string) {
  return db
    .select()
    .from(schema.bookingRequests)
    .where(eq(schema.bookingRequests.contactEmail, normaliseEmail(email)))
    .orderBy(desc(schema.bookingRequests.requestedDate), desc(schema.bookingRequests.createdAt));
}

/** What the person who booked may see — no internal notes, no terms audit trail. */
export function customerView(b: BookingRow) {
  return {
    reference: b.reference,
    status: b.status as "new" | "confirmed" | "declined" | "done",
    inspectionType: b.inspectionType,
    requestedDate: b.requestedDate,
    requestedTime: b.requestedTime,
    confirmedDate: b.status === "confirmed" || b.status === "done" ? (b.confirmedDate ?? b.requestedDate) : null,
    confirmedTime: b.status === "confirmed" || b.status === "done" ? (b.confirmedTime ?? b.requestedTime) : null,
    propertyAddress: b.propertyAddress,
    propertyCountry: b.propertyCountry === "ES" ? ("ES" as const) : ("GB" as const),
    bedrooms: b.bedrooms,
    bathrooms: b.bathrooms,
    receptionRooms: b.receptionRooms,
    furnishing: b.furnishing,
    tenantName: b.tenantName,
    accessNotes: b.accessNotes,
    createdAt: b.createdAt,
  };
}
export type CustomerBooking = ReturnType<typeof customerView>;

/* ------------------------------------------------------------------ emails */

const SERVICE_ES: Record<string, string> = {
  "Check-In Inventory": "Inventario de entrada (check-in)",
  "Check-Out Inventory": "Inventario de salida (check-out)",
  "Mid-Term Inspection": "Inspección intermedia",
};
const FURNISHING_ES: Record<string, string> = {
  Unfurnished: "Sin amueblar",
  "Part furnished": "Parcialmente amueblado",
  "Fully furnished": "Totalmente amueblado",
};

function service(b: BookingRow, lang: Lang) {
  const s = b.inspectionType?.trim() || (lang === "es" ? "Visita de inventario / inspección" : "Inventory / inspection visit");
  return lang === "es" ? (SERVICE_ES[s] ?? s) : s;
}

export function longDate(iso: string, lang: Lang) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const langOf = (b: BookingRow): Lang => (b.locale === "es" ? "es" : "en");

function button(href: string, label: string) {
  return `<p style="margin:0 0 20px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#12065C;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px">${escapeHtml(label)}</a></p>`;
}
const para = (html: string) => `<p style="margin:0 0 16px;font-size:14px">${html}</p>`;
const small = (html: string) => `<p style="margin:0 0 12px;font-size:13px;color:#5C5A6B">${html}</p>`;

function contactLine(lang: Lang) {
  const phone = OFFICE_PHONE[lang];
  return lang === "es"
    ? `¿Necesita cambiar algo? Responda a este correo o llámenos al ${phone}.`
    : `Need to change anything? Reply to this email or call us on ${phone}.`;
}

const T = {
  en: {
    ref: "Reference",
    service: "Service",
    requested: "Requested",
    bookedFor: "Booked in for",
    property: "Property",
    rooms: "Rooms",
    furnishing: "Furnishing",
    at: "at",
    view: "View my bookings",
    linkNote: `This private link shows the bookings made with your email address. It works for ${LINK_DAYS} days — you can always get a new one from the “My bookings” page on our website.`,
  },
  es: {
    ref: "Referencia",
    service: "Servicio",
    requested: "Solicitado",
    bookedFor: "Reservado para el",
    property: "Inmueble",
    rooms: "Habitaciones",
    furnishing: "Mobiliario",
    at: "a las",
    view: "Ver mis reservas",
    linkNote: `Este enlace privado muestra las reservas hechas con su dirección de correo. Funciona durante ${LINK_DAYS} días; siempre puede pedir uno nuevo en la página «Mis reservas» de nuestra web.`,
  },
};

function bookingTable(b: BookingRow, lang: Lang, slot: "requested" | "confirmed") {
  const t = T[lang];
  const date = slot === "confirmed" ? (b.confirmedDate ?? b.requestedDate) : b.requestedDate;
  const time = slot === "confirmed" ? (b.confirmedTime ?? b.requestedTime) : b.requestedTime;
  return detailRows([
    [t.ref, b.reference],
    [t.service, service(b, lang)],
    [slot === "confirmed" ? t.bookedFor : t.requested, `${longDate(date, lang)} ${t.at} ${time}`],
    [t.property, b.propertyAddress],
    [t.rooms, roomsSummary(b, lang)],
    [t.furnishing, b.furnishing ? (lang === "es" ? (FURNISHING_ES[b.furnishing] ?? b.furnishing) : b.furnishing) : null],
  ]);
}

/** Sent straight after the booking form is submitted. */
export async function sendReceivedEmail(b: BookingRow, origin: string) {
  const lang = langOf(b);
  const t = T[lang];
  const link = await issueBookingLink(b.contactEmail, origin);
  const when = `${longDate(b.requestedDate, lang)} ${t.at} ${b.requestedTime}`;
  const subject =
    lang === "es"
      ? `Hemos recibido su solicitud de reserva ${b.reference}`
      : `We've received your booking request ${b.reference}`;
  const intro =
    lang === "es"
      ? `Hola ${escapeHtml(b.contactName)}, gracias por reservar con In360View. Hemos recibido su solicitud para el <strong>${escapeHtml(when)}</strong>.`
      : `Hi ${escapeHtml(b.contactName)}, thanks for booking with In360View. We've received your request for <strong>${escapeHtml(when)}</strong>.`;
  const pending =
    lang === "es"
      ? "<strong>Todavía no está confirmada.</strong> Revisaremos la disponibilidad y le enviaremos otro correo en cuanto la visita quede reservada."
      : "<strong>This isn't confirmed yet.</strong> We'll check availability and email you again as soon as the visit is booked in.";
  return notify({
    to: b.contactEmail,
    replyTo: NOTIFY_EMAIL,
    subject,
    html: emailShell(
      lang === "es" ? "Solicitud de reserva recibida" : "Booking request received",
      para(intro) + bookingTable(b, lang, "requested") + para(pending) + button(link, t.view) + small(t.linkNote) + small(escapeHtml(contactLine(lang))),
    ),
    text: [
      subject,
      "",
      `${T[lang].requested}: ${when}`,
      `${T[lang].property}: ${b.propertyAddress}`,
      "",
      lang === "es" ? "Todavía no está confirmada; le avisaremos por correo." : "This isn't confirmed yet — we'll email you once it's booked in.",
      "",
      `${t.view}: ${link}`,
      contactLine(lang),
    ].join("\n"),
  });
}

/** Sent when the office books the visit in (accept, or the "send again" button). */
export async function sendConfirmedEmail(b: BookingRow, origin: string) {
  const lang = langOf(b);
  const t = T[lang];
  const link = await issueBookingLink(b.contactEmail, origin);
  const date = b.confirmedDate ?? b.requestedDate;
  const time = b.confirmedTime ?? b.requestedTime;
  const when = `${longDate(date, lang)} ${t.at} ${time}`;
  const moved = date !== b.requestedDate || time !== b.requestedTime;
  const subject =
    lang === "es"
      ? `Reserva confirmada: ${service(b, lang)} el ${longDate(date, lang)} a las ${time} (${b.reference})`
      : `You're booked in: ${service(b, lang)} on ${longDate(date, lang)} at ${time} (${b.reference})`;
  const intro =
    lang === "es"
      ? `Hola ${escapeHtml(b.contactName)}, su visita está <strong>confirmada</strong> para el <strong>${escapeHtml(when)}</strong>.`
      : `Hi ${escapeHtml(b.contactName)}, your visit is <strong>booked in</strong> for <strong>${escapeHtml(when)}</strong>.`;
  const movedNote = moved
    ? para(
        lang === "es"
          ? `Tenga en cuenta que es una hora distinta de la que solicitó (${escapeHtml(`${longDate(b.requestedDate, lang)} a las ${b.requestedTime}`)}).`
          : `Please note this is a different time from the one you asked for (${escapeHtml(`${longDate(b.requestedDate, lang)} at ${b.requestedTime}`)}).`,
      )
    : "";
  const access = b.accessNotes
    ? para(
        (lang === "es" ? "Acceso / llaves que nos indicó: " : "Keys / access you gave us: ") +
          `<span style="white-space:pre-wrap">${escapeHtml(b.accessNotes)}</span>`,
      )
    : para(
        lang === "es"
          ? "Responda a este correo para indicarnos cómo acceder al inmueble (llaves, alarma, aparcamiento)."
          : "Reply to this email to let us know how we get into the property (keys, alarm, parking).",
      );
  const calNote =
    lang === "es" ? "Adjuntamos una invitación de calendario (.ics)." : "A calendar invite (.ics) is attached.";
  return notify({
    to: b.contactEmail,
    replyTo: NOTIFY_EMAIL,
    subject,
    html: emailShell(
      lang === "es" ? "Su visita está confirmada" : "You're booked in",
      para(intro) + movedNote + bookingTable(b, lang, "confirmed") + access + button(link, t.view) + small(calNote) + small(escapeHtml(contactLine(lang))),
    ),
    text: [
      subject,
      "",
      `${t.bookedFor}: ${when}`,
      `${t.property}: ${b.propertyAddress}`,
      b.accessNotes ? `${lang === "es" ? "Acceso" : "Keys / access"}: ${b.accessNotes}` : null,
      "",
      `${t.view}: ${link}`,
      contactLine(lang),
    ]
      .filter((l) => l !== null)
      .join("\n"),
    attachments: [
      {
        filename: `in360view-${b.reference}.ics`,
        content: Buffer.from(bookingIcs(b, lang)).toString("base64"),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ],
  });
}

/** Sent when the office declines a request. */
export async function sendDeclinedEmail(b: BookingRow) {
  const lang = langOf(b);
  const t = T[lang];
  const when = `${longDate(b.requestedDate, lang)} ${t.at} ${b.requestedTime}`;
  const subject =
    lang === "es" ? `Sobre su solicitud de reserva ${b.reference}` : `About your booking request ${b.reference}`;
  const body =
    lang === "es"
      ? `Hola ${escapeHtml(b.contactName)}, lo sentimos: no podemos realizar la visita del <strong>${escapeHtml(when)}</strong> en ${escapeHtml(b.propertyAddress)}. Responda a este correo o llámenos al ${OFFICE_PHONE.es} y buscaremos otra fecha.`
      : `Hi ${escapeHtml(b.contactName)}, we're sorry — we can't do the visit on <strong>${escapeHtml(when)}</strong> at ${escapeHtml(b.propertyAddress)}. Reply to this email or call us on ${OFFICE_PHONE.en} and we'll find another time.`;
  return notify({
    to: b.contactEmail,
    replyTo: NOTIFY_EMAIL,
    subject,
    html: emailShell(lang === "es" ? "No podemos realizar esta visita" : "We can't do this visit", para(body) + bookingTable(b, lang, "requested")),
    text: body.replace(/<[^>]+>/g, ""),
  });
}

/** Sent from the "My bookings" page when someone asks for a fresh link. */
export async function sendLinkEmail(email: string, lang: Lang, origin: string, count: number) {
  const link = await issueBookingLink(email, origin);
  const t = T[lang];
  const subject = lang === "es" ? "Su enlace a «Mis reservas» de In360View" : "Your In360View bookings link";
  const body =
    lang === "es"
      ? `Tiene ${count} ${count === 1 ? "reserva" : "reservas"} con esta dirección de correo. Use el botón para verlas.`
      : `You have ${count} ${count === 1 ? "booking" : "bookings"} under this email address. Use the button to see ${count === 1 ? "it" : "them"}.`;
  const ignore =
    lang === "es"
      ? "Si no ha pedido este enlace, puede ignorar este correo."
      : "If you didn't ask for this link you can ignore this email.";
  return notify({
    to: email,
    replyTo: NOTIFY_EMAIL,
    subject,
    html: emailShell(lang === "es" ? "Mis reservas" : "My bookings", para(body) + button(link, t.view) + small(t.linkNote) + small(ignore)),
    text: `${body}\n\n${t.view}: ${link}\n\n${ignore}`,
  });
}

/* ---------------------------------------------------------------- calendar */

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** Folds long lines to 75 octets as RFC 5545 asks. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

/**
 * A two-hour placeholder in the property's local time ("floating" time, no
 * zone), so the visit shows at the booked hour wherever the calendar is.
 */
export function bookingIcs(b: BookingRow, lang: Lang = "en") {
  const date = (b.confirmedDate ?? b.requestedDate).replace(/-/g, "");
  const [hh, mm] = (b.confirmedTime ?? b.requestedTime).split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const endH = Math.min(hh + 2, 23);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = `In360View — ${service(b, lang)} (${b.reference})`;
  const desc = [
    `${T[lang].ref}: ${b.reference}`,
    roomsSummary(b, lang),
    b.accessNotes ? `${lang === "es" ? "Acceso" : "Keys / access"}: ${b.accessNotes}` : null,
    contactLine(lang),
  ]
    .filter(Boolean)
    .join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//In360View//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@in360view.co.uk`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${date}T${pad(hh)}${pad(mm)}00`,
    `DTEND:${date}T${pad(endH)}${pad(endH === hh + 2 ? mm : 59)}00`,
    `SUMMARY:${icsEscape(title)}`,
    `LOCATION:${icsEscape(b.propertyAddress)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
