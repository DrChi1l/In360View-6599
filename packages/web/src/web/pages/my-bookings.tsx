import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarCheck2, CalendarClock, CheckCircle2, Clock, Home, KeyRound, Mail, MapPin, Phone, XCircle } from "lucide-react";
import { Logo } from "../components/logo";
import { LanguageSwitch } from "../components/language-switch";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/field";
import { ErrorNote, Loading, Spinner } from "../components/empty-state";
import { localeFor, useCopy, useDocumentTitle, useLang, type Lang } from "../lib/i18n";
import { useMyBookings, useRequestBookingLink } from "../queries/my-bookings";
import { roomsSummary } from "../../api/lib/booking-rooms";
import type { CustomerBooking } from "../../api/lib/booking-customer";
import { cn } from "@/lib/utils";

type Status = CustomerBooking["status"];

const COPY = {
  en: {
    docTitle: "My bookings · In360View",
    back: "Back to home",
    title: "My bookings",
    intro:
      "Enter the email address you booked with and we'll send you a private link to see your bookings and whether they're booked in.",
    emailLabel: "Email address",
    send: "Email me my link",
    sentTitle: "Check your inbox",
    sent: (email: string) =>
      `If there are bookings under ${email}, a link is on its way. It can take a minute — check your junk folder too.`,
    again: "Use a different email",
    expired: "This link has expired or isn't valid. Enter your email below and we'll send a new one.",
    yours: "Your bookings",
    madeWith: "Bookings made with",
    none: "There are no bookings under this email address any more.",
    upcoming: "Upcoming",
    earlier: "Earlier",
    ref: "Reference",
    requested: "Requested",
    bookedFor: "Booked in for",
    rooms: "Rooms",
    tenant: "Tenant",
    access: "Keys / access",
    at: "at",
    steps: ["Requested", "Booked in", "Completed"],
    status: {
      new: "Request received — we'll email you once it's booked in.",
      confirmed: "Booked in. We'll see you then.",
      done: "Visit completed.",
      declined: "We couldn't do this time. Call or email us and we'll find another.",
    } satisfies Record<Status, string>,
    badge: { new: "Awaiting confirmation", confirmed: "Booked in", done: "Completed", declined: "Not going ahead" },
    moved: "Different from the time you asked for",
    change: "Need to change or cancel? Get in touch and quote your reference.",
    phone: "07990 060618",
    phoneHref: "tel:07990060618",
    bookAnother: "Book another visit",
    privacy: "This private link only shows bookings made with your email address. Don't forward it.",
  },
  es: {
    docTitle: "Mis reservas · In360View",
    back: "Volver al inicio",
    title: "Mis reservas",
    intro:
      "Introduzca la dirección de correo con la que reservó y le enviaremos un enlace privado para ver sus reservas y si están confirmadas.",
    emailLabel: "Correo electrónico",
    send: "Enviarme el enlace",
    sentTitle: "Revise su bandeja de entrada",
    sent: (email: string) =>
      `Si hay reservas con ${email}, le hemos enviado un enlace. Puede tardar un minuto; revise también la carpeta de correo no deseado.`,
    again: "Usar otro correo",
    expired: "Este enlace ha caducado o no es válido. Introduzca su correo y le enviaremos uno nuevo.",
    yours: "Sus reservas",
    madeWith: "Reservas hechas con",
    none: "Ya no hay reservas con esta dirección de correo.",
    upcoming: "Próximas",
    earlier: "Anteriores",
    ref: "Referencia",
    requested: "Solicitado",
    bookedFor: "Reservado para el",
    rooms: "Habitaciones",
    tenant: "Inquilino",
    access: "Llaves / acceso",
    at: "a las",
    steps: ["Solicitada", "Confirmada", "Realizada"],
    status: {
      new: "Solicitud recibida: le escribiremos en cuanto la visita quede confirmada.",
      confirmed: "Visita confirmada. Nos vemos ese día.",
      done: "Visita realizada.",
      declined: "No pudimos hacer la visita a esa hora. Llámenos o escríbanos y buscaremos otra.",
    } satisfies Record<Status, string>,
    badge: { new: "Pendiente de confirmar", confirmed: "Confirmada", done: "Realizada", declined: "No se realizará" },
    moved: "Distinta de la hora que solicitó",
    change: "¿Necesita cambiarla o cancelarla? Contacte con nosotros indicando su referencia.",
    phone: "+44 7990 060618",
    phoneHref: "tel:+447990060618",
    bookAnother: "Reservar otra visita",
    privacy: "Este enlace privado solo muestra las reservas hechas con su correo. No lo reenvíe.",
  },
};

const SERVICE_ES: Record<string, string> = {
  "Check-In Inventory": "Inventario de entrada (check-in)",
  "Check-Out Inventory": "Inventario de salida (check-out)",
  "Mid-Term Inspection": "Inspección intermedia",
};

const BADGE_TONE: Record<Status, string> = {
  new: "bg-warn-soft text-warn",
  confirmed: "bg-ok-soft text-ok",
  done: "bg-brand-100 text-brand-800",
  declined: "bg-ink-100 text-ink-500",
};

function longDate(iso: string, lang: Lang) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(localeFor(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Public: people who booked see their bookings through a private emailed link. */
export default function MyBookings({ token }: { token?: string }) {
  const c = useCopy(COPY);
  useDocumentTitle(c.docTitle);
  const list = useMyBookings(token);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="min-w-0 shrink">
            <Logo size={26} withTagline />
          </Link>
          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-800"
        >
          <ArrowLeft className="size-4" /> {c.back}
        </Link>

        {token && list.isLoading ? (
          <Loading />
        ) : token && list.data ? (
          <BookingList email={list.data.email} bookings={list.data.bookings} />
        ) : (
          <>
            <h1 className="text-[32px] font-bold leading-tight text-ink-900 sm:text-[40px]">{c.title}</h1>
            {token && list.isError && (
              <p
                role="alert"
                className="mt-5 rounded-[12px] border border-warn/30 bg-warn-soft px-4 py-3 text-[14px] text-ink-900"
              >
                {c.expired}
              </p>
            )}
            <RequestLink />
          </>
        )}

        <ContactBox />
      </main>
    </div>
  );
}

function RequestLink() {
  const c = useCopy(COPY);
  const { lang } = useLang();
  const request = useRequestBookingLink();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    await request.mutateAsync({ email: value, locale: lang });
    setSentTo(value);
  }

  if (sentTo) {
    return (
      <output className="mt-6 block rounded-[16px] border border-ink-100 bg-white p-6 shadow-soft">
        <Mail className="size-7 text-brand-500" aria-hidden />
        <h2 className="mt-3 text-[18px] font-semibold text-ink-900">{c.sentTitle}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-700">{c.sent(sentTo)}</p>
        <button
          type="button"
          className="mt-4 text-[14px] font-semibold text-brand-800 hover:underline"
          onClick={() => {
            setSentTo(null);
            request.reset();
          }}
        >
          {c.again}
        </button>
      </output>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-[16px] border border-ink-100 bg-white p-6 shadow-soft">
      <p className="text-[15px] leading-relaxed text-ink-700">{c.intro}</p>
      <div className="mt-5 grid gap-1.5">
        <Label htmlFor="my-bookings-email">{c.emailLabel}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="my-bookings-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 flex-1"
          />
          <Button type="submit" className="h-11 rounded-[10px] px-5" disabled={request.isPending}>
            {request.isPending ? <Spinner /> : <Mail className="size-4" />}
            {c.send}
          </Button>
        </div>
      </div>
      <ErrorNote error={request.error} className="mt-3" />
    </form>
  );
}

function BookingList({ email, bookings }: { email: string; bookings: CustomerBooking[] }) {
  const c = useCopy(COPY);
  const today = todayIso();
  const slotDate = (b: CustomerBooking) => b.confirmedDate ?? b.requestedDate;
  const isUpcoming = (b: CustomerBooking) => (b.status === "new" || b.status === "confirmed") && slotDate(b) >= today;
  const upcoming = bookings.filter(isUpcoming).sort((a, b) => slotDate(a).localeCompare(slotDate(b)));
  const earlier = bookings.filter((b) => !isUpcoming(b));

  return (
    <>
      <h1 className="text-[32px] font-bold leading-tight text-ink-900 sm:text-[40px]">{c.yours}</h1>
      <p className="mt-2 break-all text-[14px] text-ink-500">
        {c.madeWith} <span className="font-semibold text-ink-900">{email}</span>
      </p>

      {!bookings.length && (
        <p className="mt-6 rounded-[16px] border border-ink-100 bg-white p-6 text-[14px] text-ink-700">{c.none}</p>
      )}

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500">{c.upcoming}</h2>
          <div className="grid gap-3">
            {upcoming.map((b) => (
              <BookingCard key={b.reference} b={b} />
            ))}
          </div>
        </section>
      )}

      {earlier.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500">{c.earlier}</h2>
          <div className="grid gap-3">
            {earlier.map((b) => (
              <BookingCard key={b.reference} b={b} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/sign-in?book=1"
          className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand-800 px-5 text-[14px] font-semibold text-white hover:bg-brand-900"
        >
          <CalendarClock className="size-4" /> {c.bookAnother}
        </Link>
      </div>
      <p className="mt-4 text-[12px] text-ink-500">{c.privacy}</p>
    </>
  );
}

function BookingCard({ b }: { b: CustomerBooking }) {
  const c = useCopy(COPY);
  const { lang } = useLang();
  const booked = b.status === "confirmed" || b.status === "done";
  const date = booked ? b.confirmedDate! : b.requestedDate;
  const time = booked ? b.confirmedTime! : b.requestedTime;
  const moved = booked && (b.confirmedDate !== b.requestedDate || b.confirmedTime !== b.requestedTime);
  const service = b.inspectionType ? (lang === "es" ? (SERVICE_ES[b.inspectionType] ?? b.inspectionType) : b.inspectionType) : null;
  const step = b.status === "new" ? 0 : b.status === "confirmed" ? 1 : b.status === "done" ? 2 : -1;

  return (
    <article className="rounded-[16px] border border-ink-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
            BADGE_TONE[b.status],
          )}
        >
          {c.badge[b.status]}
        </span>
        <span className="text-[12px] font-medium tabular-nums text-ink-500">
          {c.ref} {b.reference}
        </span>
        {service && (
          <>
            <span className="text-[12px] text-ink-300" aria-hidden>
              ·
            </span>
            <span className="text-[12px] text-ink-500">{service}</span>
          </>
        )}
      </div>

      <p
        className={cn(
          "mt-3 flex items-start gap-2 text-[17px] font-semibold",
          b.status === "declined" ? "text-ink-500 line-through decoration-ink-300" : "text-ink-900",
        )}
      >
        {booked ? (
          <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
        ) : (
          <Clock className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
        )}
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {booked ? c.bookedFor : c.requested}
          </span>
          {longDate(date, lang)} {c.at} {time}
        </span>
      </p>
      {moved && (
        <p className="mt-1 pl-7 text-[12px] text-ink-500">
          {c.moved}: {longDate(b.requestedDate, lang)} {c.at} {b.requestedTime}
        </p>
      )}

      <p className="mt-3 flex items-start gap-2 text-[14px] text-ink-700">
        <MapPin className="mt-0.5 size-4 shrink-0 text-ink-300" aria-hidden />
        {b.propertyAddress}
      </p>

      {step >= 0 ? (
        <ol className="mt-4 grid grid-cols-3 gap-1.5" aria-label={c.status[b.status]}>
          {c.steps.map((label, i) => (
            <li key={label} className="grid gap-1.5">
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-ok" : "bg-ink-100")} aria-hidden />
              <span className={cn("text-[11px] font-medium", i <= step ? "text-ink-900" : "text-ink-500")}>
                {i <= step && <CheckCircle2 className="mr-1 inline size-3 text-ok" aria-hidden />}
                {label}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <p
        className={cn(
          "mt-3 flex items-start gap-2 rounded-[10px] px-3 py-2 text-[13px]",
          b.status === "declined" ? "bg-ink-100 text-ink-700" : "bg-canvas text-ink-700",
        )}
      >
        {b.status === "declined" && <XCircle className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />}
        {c.status[b.status]}
      </p>

      <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-3.5 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-500">
            <Home className="size-3.5" aria-hidden /> {c.rooms}
          </dt>
          <dd className="mt-1 text-ink-900">{roomsSummary(b, lang) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-500">{c.tenant}</dt>
          <dd className="mt-1 text-ink-900">{b.tenantName || "—"}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-500">
            <KeyRound className="size-3.5" aria-hidden /> {c.access}
          </dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-ink-900">{b.accessNotes || "—"}</dd>
        </div>
      </dl>
    </article>
  );
}

function ContactBox() {
  const c = useCopy(COPY);
  return (
    <aside className="mt-10 rounded-[16px] border border-ink-100 bg-white p-5 text-[14px] text-ink-700">
      <p>{c.change}</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-semibold text-brand-800">
        <a href="mailto:in360view@outlook.com" className="inline-flex min-h-11 items-center gap-2 hover:underline">
          <Mail className="size-4" aria-hidden /> in360view@outlook.com
        </a>
        <a href={c.phoneHref} className="inline-flex min-h-11 items-center gap-2 hover:underline">
          <Phone className="size-4" aria-hidden /> {c.phone}
        </a>
      </div>
    </aside>
  );
}
