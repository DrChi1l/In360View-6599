import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, ShieldCheck, X } from "lucide-react";
import { BOOKING_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from "../../api/lib/booking-terms";
import { Button } from "./ui/button";
import { Card, Field, Input, Label, Select, Textarea } from "./ui/field";
import { ErrorNote, Spinner } from "./empty-state";
import { LegalText } from "./legal-text";
import { useRequestBooking } from "../queries/bookings";
import { cn } from "@/lib/utils";
import { localeFor, useCopy, useLang, type Lang } from "../lib/i18n";
import { legalDocs } from "../lib/legal";
import {
  EMPTY_SPANISH_ADDRESS,
  SpanishAddressFields,
  spanishDraftToInput,
  type SpanishAddressDraft,
} from "./spanish-address";
import { BATHROOM_OPTIONS, BEDROOM_OPTIONS, RECEPTION_OPTIONS } from "../../api/lib/booking-rooms";
import { postcodeMatchesProvince, type PropertyCountry } from "../../api/lib/spain-address";

/** Stored values stay in English for the office; only the labels are translated. */
const FURNISHING = ["Unfurnished", "Part furnished", "Fully furnished"];
const INSPECTION_TYPES = ["Check-In Inventory", "Check-Out Inventory", "Mid-Term Inspection"];

const COPY = {
  en: {
    furnishing: { Unfurnished: "Unfurnished", "Part furnished": "Part furnished", "Fully furnished": "Fully furnished" },
    inspection: {
      "Check-In Inventory": "Check-In Inventory",
      "Check-Out Inventory": "Check-Out Inventory",
      "Mid-Term Inspection": "Mid-Term Inspection",
    },
    prevMonth: "Previous month",
    nextMonth: "Next month",
    receivedTitle: "Booking request received",
    receivedBody: (ref: React.ReactNode, when: string, time: string) => (
      <>
        Your reference is {ref}. We have your request for {when} at {time}. It isn't booked in yet — we'll email you
        as soon as it is.
      </>
    ),
    emailedCopy: (email: React.ReactNode) => <>We've emailed a copy to {email}, with a private link to your bookings.</>,
    notEmailed: "Keep your reference — you can check this booking any time on the My bookings page.",
    myBookings: "View my bookings",
    bookAnother: "Book another property",
    chooseDate: "Choose a date",
    chooseTime: "Choose a time",
    selected: "Selected:",
    at: "at",
    name: "Full name (landlord / agent) *",
    email: "Email address *",
    phone: "Contact number *",
    address: "Property address *",
    addressHint: "Include the postcode — e.g. 14 Chapel Street, Manchester, M1 2AB",
    country: "Where is the property?",
    countries: { GB: "United Kingdom", ES: "Spain" },
    postalWrong: "The postcode doesn't match the province — check it, or leave it blank.",
    roomsHeading: "Number of rooms",
    bedrooms: "Bedrooms *",
    bathrooms: "Bathrooms *",
    reception: "Reception rooms",
    receptionHint: "Lounge, dining room, study",
    studio: "Studio",
    choose: "Choose…",
    bigQuote: "For 6 or more bedrooms we'll confirm a bespoke quote before the visit.",
    furnishingLabel: "Furnishing",
    inspectionLabel: "Inspection type",
    tenantHeading: "Tenant details (optional)",
    tenantName: "Tenant full name",
    tenantEmail: "Tenant email",
    tenantPhone: "Tenant contact number",
    access: "Keys / access details",
    accessPlaceholder: "Where to collect keys, alarm codes, parking, tenant availability.",
    submit: "Request booking",
    noPayment:
      "No payment is taken now. You will be asked to review and agree to our booking terms and data retention notice before the request is sent. We confirm the visit by email before attending.",
    tabs: { summary: "Key points", terms: "Terms", privacy: "Privacy & retention" },
    tabsLabel: "Booking documents",
    sendError: "The booking could not be sent. Please try again.",
    staleTerms: "Our booking terms have been updated. Please reload the page and review them before booking.",
    beforeSend: "Before we send your booking",
    termsTitle: "Terms & data retention",
    updated: "Last updated",
    closeTerms: "Close and return to the booking form",
    summaryIntro:
      "We need to keep the details in this booking to carry out your inventory or inspection and to stand behind the report afterwards. Here is what you are agreeing to — the full documents are in the other tabs.",
    openFull: "Open the full terms in a new tab",
    agreeTerms: (
      <>
        I have read and agree to the <strong>Booking Terms and Conditions</strong>.
      </>
    ),
    agreePrivacy: (
      <>
        I have read the <strong>Privacy &amp; Data Retention Notice</strong> and understand that my booking details
        will be stored for a limited period to carry out the inventory or inspection, as explained there.
      </>
    ),
    tenantClause: " I confirm I am entitled to share the tenant details I have given and will let the tenant know.",
    back: "Back to booking",
    agree: "Agree and send booking",
    dialogTitle: "Book an inventory or inspection",
    dialogIntro:
      "Pick a date and time, tell us about the property and how to access the keys, and we'll confirm your booking by email.",
    closeDialog: "Close booking form",
  },
  es: {
    furnishing: { Unfurnished: "Sin amueblar", "Part furnished": "Parcialmente amueblado", "Fully furnished": "Totalmente amueblado" },
    inspection: {
      "Check-In Inventory": "Inventario de entrada (check-in)",
      "Check-Out Inventory": "Inventario de salida (check-out)",
      "Mid-Term Inspection": "Inspección intermedia",
    },
    prevMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    receivedTitle: "Solicitud de reserva recibida",
    receivedBody: (ref: React.ReactNode, when: string, time: string) => (
      <>
        Su referencia es {ref}. Hemos recibido su solicitud para el {when} a las {time}. Todavía no está confirmada:
        le escribiremos en cuanto la visita quede reservada.
      </>
    ),
    emailedCopy: (email: React.ReactNode) => (
      <>Hemos enviado una copia a {email}, con un enlace privado a sus reservas.</>
    ),
    notEmailed: "Guarde su referencia: puede consultar esta reserva en cualquier momento en la página Mis reservas.",
    myBookings: "Ver mis reservas",
    bookAnother: "Reservar otro inmueble",
    chooseDate: "Elija una fecha",
    chooseTime: "Elija una hora",
    selected: "Seleccionado:",
    at: "a las",
    name: "Nombre completo (propietario / agencia) *",
    email: "Correo electrónico *",
    phone: "Teléfono de contacto *",
    address: "Dirección del inmueble *",
    addressHint: "Incluya el código postal; p. ej., 14 Chapel Street, Manchester, M1 2AB",
    country: "¿Dónde está el inmueble?",
    countries: { GB: "Reino Unido", ES: "España" },
    postalWrong: "El código postal no corresponde a la provincia; revíselo o déjelo en blanco.",
    roomsHeading: "Número de estancias",
    bedrooms: "Dormitorios *",
    bathrooms: "Baños *",
    reception: "Salones",
    receptionHint: "Salón, comedor, despacho",
    studio: "Estudio",
    choose: "Elija…",
    bigQuote: "Para 6 dormitorios o más le confirmaremos un presupuesto a medida antes de la visita.",
    furnishingLabel: "Amueblado",
    inspectionLabel: "Tipo de inspección",
    tenantHeading: "Datos del inquilino (opcional)",
    tenantName: "Nombre completo del inquilino",
    tenantEmail: "Correo electrónico del inquilino",
    tenantPhone: "Teléfono del inquilino",
    access: "Llaves / datos de acceso",
    accessPlaceholder: "Dónde recoger las llaves, códigos de alarma, aparcamiento, disponibilidad del inquilino.",
    submit: "Solicitar reserva",
    noPayment:
      "Ahora no se cobra nada. Antes de enviar la solicitud, le pediremos que revise y acepte nuestras condiciones de reserva y el aviso de conservación de datos. Confirmamos la visita por correo electrónico antes de acudir.",
    tabs: { summary: "Puntos clave", terms: "Condiciones", privacy: "Privacidad" },
    tabsLabel: "Documentos de la reserva",
    sendError: "No se ha podido enviar la reserva. Inténtelo de nuevo.",
    staleTerms:
      "Nuestras condiciones de reserva se han actualizado. Vuelva a cargar la página y revíselas antes de reservar.",
    beforeSend: "Antes de enviar su reserva",
    termsTitle: "Condiciones y conservación de datos",
    updated: "Última actualización:",
    closeTerms: "Cerrar y volver al formulario de reserva",
    summaryIntro:
      "Necesitamos conservar los datos de esta reserva para realizar su inventario o inspección y para respaldar el informe después. Esto es lo que acepta; los documentos completos están en las otras pestañas.",
    openFull: "Abrir las condiciones completas en una pestaña nueva",
    agreeTerms: (
      <>
        He leído y acepto las <strong>Condiciones de Reserva</strong>.
      </>
    ),
    agreePrivacy: (
      <>
        He leído el <strong>Aviso de Privacidad y Conservación de Datos</strong> y entiendo que los datos de mi reserva
        se guardarán durante un periodo limitado para realizar el inventario o la inspección, tal como allí se explica.
      </>
    ),
    tenantClause:
      " Confirmo que tengo derecho a compartir los datos del inquilino que he facilitado y que se lo comunicaré.",
    back: "Volver a la reserva",
    agree: "Aceptar y enviar la reserva",
    dialogTitle: "Reserve un inventario o una inspección",
    dialogIntro:
      "Elija fecha y hora, cuéntenos cómo es el inmueble y cómo acceder a las llaves, y le confirmaremos la reserva por correo electrónico.",
    closeDialog: "Cerrar el formulario de reserva",
  },
};

const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => {
  const minutes = 9 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function monthLabel(d: Date, lang: Lang) {
  const label = d.toLocaleDateString(localeFor(lang), { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Sunday-first short weekday names, matching the grid below. */
function weekdayLabels(lang: Lang) {
  const sunday = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const label = d.toLocaleDateString(localeFor(lang), { weekday: "short" }).replace(".", "");
    return label.charAt(0).toUpperCase() + label.slice(1, 2);
  });
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function longDate(value: string, lang: Lang) {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(localeFor(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}


function MonthCalendar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const dow = useMemo(() => weekdayLabels(lang), [lang]);
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const atFirstMonth =
    cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();

  return (
    <div className="rounded-[14px] border border-ink-200 bg-white p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          aria-label={c.prevMonth}
          disabled={atFirstMonth}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="grid size-8 place-items-center rounded-[8px] border border-ink-200 text-ink-700 transition-colors hover:bg-brand-50 disabled:opacity-35"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-[15px] font-semibold text-ink-900">
          {monthLabel(cursor, lang)}
        </p>
        <button
          type="button"
          aria-label={c.nextMonth}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="grid size-8 place-items-center rounded-[8px] border border-ink-200 text-ink-700 transition-colors hover:bg-brand-50"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-medium text-ink-500">
        {dow.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const key = iso(d);
          const outside = d.getMonth() !== cursor.getMonth();
          const past = d < today;
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              disabled={past}
              onClick={() => onChange(key)}
              className={cn(
                "grid h-9 place-items-center rounded-[8px] text-[13px] tabular-nums transition-colors",
                selected
                  ? "bg-gold-500 font-semibold text-white"
                  : past
                    ? "text-ink-200"
                    : outside
                      ? "text-ink-300 hover:bg-brand-50"
                      : "text-ink-900 hover:bg-brand-50",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  propertyAddress: "",
  bedrooms: "",
  bathrooms: "1",
  receptionRooms: "1",
  furnishing: FURNISHING[0],
  inspectionType: INSPECTION_TYPES[0],
  tenantName: "",
  tenantEmail: "",
  tenantPhone: "",
  accessNotes: "",
};

function BookingForm() {
  const { lang } = useLang();
  const c = COPY[lang];
  const request = useRequestBooking();
  const [date, setDate] = useState(() => iso(new Date()));
  const [time, setTime] = useState("10:00");
  const [form, setForm] = useState(EMPTY_FORM);
  // Spanish speakers usually book a Spanish property, but either can be chosen.
  const [country, setCountry] = useState<PropertyCountry>(lang === "es" ? "ES" : "GB");
  const [countryTouched, setCountryTouched] = useState(false);
  const [esAddress, setEsAddress] = useState<SpanishAddressDraft>(EMPTY_SPANISH_ADDRESS);
  useEffect(() => {
    if (!countryTouched) setCountry(lang === "es" ? "ES" : "GB");
  }, [lang, countryTouched]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; email: string; emailed: boolean } | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const hasTenantDetails = Boolean(form.tenantName.trim() || form.tenantEmail.trim() || form.tenantPhone.trim());

  // The form's own validation runs first; only a complete booking opens the terms pop-up.
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (country === "ES" && !postcodeMatchesProvince(esAddress.postalCode.trim(), esAddress.provinceCode)) {
      setError(c.postalWrong);
      return;
    }
    setReviewing(true);
  }

  async function send() {
    const row = await request.mutateAsync({
      requestedDate: date,
      requestedTime: time,
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      propertyCountry: country,
      propertyAddress: country === "GB" ? form.propertyAddress.trim() : "",
      propertyAddressEs: country === "ES" ? spanishDraftToInput(esAddress) : null,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      receptionRooms: Number(form.receptionRooms),
      furnishing: form.furnishing,
      inspectionType: form.inspectionType,
      tenantName: form.tenantName.trim() || null,
      tenantEmail: form.tenantEmail.trim() || null,
      tenantPhone: form.tenantPhone.trim() || null,
      accessNotes: form.accessNotes.trim() || null,
      acceptTerms: true,
      acceptPrivacy: true,
      termsVersion: BOOKING_TERMS_VERSION,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      locale: lang,
    });
    setReviewing(false);
    setDone({ reference: row.reference, email: form.contactEmail.trim(), emailed: row.emailed });
  }

  if (done) {
    return (
      <Card className="mx-auto grid max-w-xl gap-3 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-ok" />
        <h3 className="text-[20px] font-bold text-ink-900">{c.receivedTitle}</h3>
        <p className="text-[14px] text-ink-500">
          {c.receivedBody(
            <span className="font-semibold text-ink-900">{done.reference}</span>,
            longDate(date, lang),
            time,
          )}
        </p>
        <p className="text-[14px] text-ink-500">
          {done.emailed ? c.emailedCopy(<span className="break-all font-semibold text-ink-900">{done.email}</span>) : c.notEmailed}
        </p>
        <Link
          href="/my-bookings"
          className="mx-auto mt-1 text-[14px] font-semibold text-brand-800 underline-offset-4 hover:underline"
        >
          {c.myBookings}
        </Link>
        <Button
          type="button"
          variant="outline"
          className="mx-auto mt-2 h-10 rounded-[10px]"
          onClick={() => {
            setDone(null);
            setForm(EMPTY_FORM);
            setEsAddress(EMPTY_SPANISH_ADDRESS);
          }}
        >
          {c.bookAnother}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border-0 p-0 shadow-none sm:border sm:p-7 sm:shadow-soft">
      <form className="grid gap-7 lg:grid-cols-2 lg:gap-9" onSubmit={submit}>
        <div className="grid content-start gap-5">
          <div>
            <p className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold text-ink-900">
              <CalendarDays className="size-4.5 text-brand-500" />
              {c.chooseDate}
            </p>
            <MonthCalendar value={date} onChange={setDate} />
          </div>
          <div>
            <p className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold text-ink-900">
              <Clock className="size-4.5 text-brand-500" />
              {c.chooseTime}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-6">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={cn(
                    "h-9 rounded-[8px] border text-[13px] tabular-nums transition-colors",
                    slot === time
                      ? "border-brand-800 bg-brand-800 font-semibold text-white"
                      : "border-ink-200 bg-white text-ink-700 hover:border-brand-500 hover:text-brand-800",
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-ink-500">
              {c.selected} <span className="font-medium text-ink-900">{longDate(date, lang)}</span> {c.at}{" "}
              <span className="font-medium text-ink-900">{time}</span>
            </p>
          </div>
        </div>

        <div className="grid content-start gap-3.5">
          <Field label={c.name}>
            <Input
              value={form.contactName}
              onChange={(e) => set("contactName")(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>
          <Field label={c.email}>
            <Input
              type="email"
              value={form.contactEmail}
              onChange={(e) => set("contactEmail")(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label={c.phone}>
            <Input
              type="tel"
              value={form.contactPhone}
              onChange={(e) => set("contactPhone")(e.target.value)}
              autoComplete="tel"
              required
            />
          </Field>
          <fieldset className="m-0 grid min-w-0 gap-2.5 border-0 p-0">
            <legend className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
              {c.country}
            </legend>
            <div className="grid grid-cols-2 gap-1 rounded-[11px] border border-ink-200 bg-white p-1">
              {(["GB", "ES"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={country === k}
                  onClick={() => {
                    setCountry(k);
                    setCountryTouched(true);
                  }}
                  className={cn(
                    "h-9 rounded-[8px] text-[14px] font-medium transition-colors",
                    country === k ? "bg-brand-800 text-white" : "text-ink-700 hover:text-brand-800",
                  )}
                >
                  {c.countries[k]}
                </button>
              ))}
            </div>
          </fieldset>
          {country === "GB" ? (
            <Field label={c.address} hint={c.addressHint} htmlFor="booking-address">
              <Input
                id="booking-address"
                value={form.propertyAddress}
                onChange={(e) => set("propertyAddress")(e.target.value)}
                autoComplete="street-address"
                required
              />
            </Field>
          ) : (
            <SpanishAddressFields
              value={esAddress}
              onChange={(next) => {
                setEsAddress(next);
                setError(null);
              }}
            />
          )}
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
              {c.roomsHeading}
            </legend>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
              <Field label={c.bedrooms} htmlFor="booking-bedrooms">
                <Select
                  id="booking-bedrooms"
                  value={form.bedrooms}
                  onChange={(e) => set("bedrooms")(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {c.choose}
                  </option>
                  {BEDROOM_OPTIONS.map((n, i) => (
                    <option key={n} value={String(n)}>
                      {n === 0 ? c.studio : i === BEDROOM_OPTIONS.length - 1 ? `${n}+` : n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={c.bathrooms} htmlFor="booking-bathrooms">
                <Select
                  id="booking-bathrooms"
                  value={form.bathrooms}
                  onChange={(e) => set("bathrooms")(e.target.value)}
                  required
                >
                  {BATHROOM_OPTIONS.map((n, i) => (
                    <option key={n} value={String(n)}>
                      {i === BATHROOM_OPTIONS.length - 1 ? `${n}+` : n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={c.reception} htmlFor="booking-reception">
                <Select
                  id="booking-reception"
                  value={form.receptionRooms}
                  onChange={(e) => set("receptionRooms")(e.target.value)}
                >
                  {RECEPTION_OPTIONS.map((n, i) => (
                    <option key={n} value={String(n)}>
                      {i === RECEPTION_OPTIONS.length - 1 ? `${n}+` : n}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="mt-1 text-[12px] text-ink-500">
              {Number(form.bedrooms) >= BEDROOM_OPTIONS[BEDROOM_OPTIONS.length - 1] ? c.bigQuote : c.receptionHint}
            </p>
          </fieldset>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label={c.furnishingLabel}>
              <Select value={form.furnishing} onChange={(e) => set("furnishing")(e.target.value)}>
                {FURNISHING.map((f) => (
                  <option key={f} value={f}>
                    {c.furnishing[f as keyof typeof c.furnishing]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={c.inspectionLabel}>
              <Select value={form.inspectionType} onChange={(e) => set("inspectionType")(e.target.value)}>
                {INSPECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {c.inspection[t as keyof typeof c.inspection]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-1 border-t border-ink-100 pt-4">
            <Label className="mb-3 text-ink-300">{c.tenantHeading}</Label>
            <div className="grid gap-3.5">
              <Field label={c.tenantName}>
                <Input value={form.tenantName} onChange={(e) => set("tenantName")(e.target.value)} />
              </Field>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label={c.tenantEmail}>
                  <Input
                    type="email"
                    value={form.tenantEmail}
                    onChange={(e) => set("tenantEmail")(e.target.value)}
                  />
                </Field>
                <Field label={c.tenantPhone}>
                  <Input
                    type="tel"
                    value={form.tenantPhone}
                    onChange={(e) => set("tenantPhone")(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>

          <Field label={c.access}>
            <Textarea
              value={form.accessNotes}
              onChange={(e) => set("accessNotes")(e.target.value)}
              placeholder={c.accessPlaceholder}
            />
          </Field>

          <ErrorNote error={error} />
          <Button type="submit" className="h-11 rounded-[10px] text-[15px]" disabled={request.isPending}>
            {c.submit}
          </Button>
          <p className="text-[12px] text-ink-500">{c.noPayment}</p>
        </div>
      </form>
      <TermsDialog
        open={reviewing}
        hasTenantDetails={hasTenantDetails}
        pending={request.isPending}
        onCancel={() => setReviewing(false)}
        onAgree={send}
      />
    </Card>
  );
}


/** Native modal dialog: top layer, focus containment and Escape come from the browser. */
function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Nothing is rendered until the first open; after that the content stays
  // mounted so a half-filled form survives an accidental close.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={cn(
        "m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-white p-0 text-ink-900 backdrop:bg-brand-900/65 backdrop:backdrop-blur-[2px] open:flex open:flex-col sm:m-auto sm:h-auto sm:max-h-[92dvh] sm:rounded-[18px] sm:shadow-2xl",
        className,
      )}
    >
      {mounted && children}
    </dialog>
  );
}

const TABS = ["summary", "terms", "privacy"] as const;

function TermsDialog({
  open,
  hasTenantDetails,
  pending,
  onCancel,
  onAgree,
}: {
  open: boolean;
  hasTenantDetails: boolean;
  pending: boolean;
  onCancel: () => void;
  onAgree: () => Promise<void>;
}) {
  const { lang } = useLang();
  const c = COPY[lang];
  const docs = legalDocs(lang);
  const [tab, setTab] = useState<(typeof TABS)[number]>("summary");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Every review starts fresh — nothing is pre-ticked, even on a second attempt.
  useEffect(() => {
    if (!open) return;
    setTab("summary");
    setTerms(false);
    setPrivacy(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const close = useCallback(() => {
    if (!pending) onCancel();
  }, [pending, onCancel]);

  async function agree() {
    setError(null);
    try {
      await onAgree();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "CONFLICT") setError(c.staleTerms);
      else if (lang === "es") setError(c.sendError);
      else setError(err instanceof Error ? err.message : c.sendError);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy="booking-terms-title" className="sm:max-w-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 pb-3 pt-5 sm:px-7">
        <div>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-500">
            <ShieldCheck className="size-4" /> {c.beforeSend}
          </p>
          <h3 id="booking-terms-title" className="mt-1 text-[20px] font-bold text-ink-900">
            {c.termsTitle}
          </h3>
          <p className="mt-1 text-[12px] text-ink-500">
            {c.updated} {docs.updated}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={c.closeTerms}
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100"
        >
          <X className="size-5" />
        </button>
      </div>

      <div role="tablist" aria-label={c.tabsLabel} className="flex gap-1 overflow-x-auto border-b border-ink-100 px-4 sm:px-6">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="booking-terms-panel"
            onClick={() => setTab(t)}
            className={cn(
              "min-h-11 shrink-0 border-b-2 px-3 text-[14px] font-semibold transition-colors",
              tab === t ? "border-brand-800 text-brand-800" : "border-transparent text-ink-500 hover:text-ink-900",
            )}
          >
            {c.tabs[t]}
          </button>
        ))}
      </div>

      <div
        ref={bodyRef}
        id="booking-terms-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 outline-none sm:max-h-[44dvh] sm:px-7"
      >
        {docs.translationNotice && (
          <p className="mb-4 rounded-[10px] border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-700">
            {docs.translationNotice}
          </p>
        )}
        {tab === "summary" && (
          <div className="grid gap-4">
            <p className="text-[14px] leading-relaxed text-ink-700">{c.summaryIntro}</p>
            <ul className="grid gap-3">
              {docs.keyPoints.map((point) => (
                <li key={point} className="flex gap-3 text-[14px] leading-relaxed text-ink-700">
                  <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
        {tab === "terms" && <LegalText sections={docs.terms} />}
        {tab === "privacy" && <LegalText sections={docs.privacy} />}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-800 hover:underline"
        >
          {c.openFull} <ExternalLink className="size-3.5" />
        </a>
      </div>

      <div className="grid gap-3 border-t border-ink-100 bg-canvas px-5 py-4 sm:px-7">
        <label className="flex cursor-pointer gap-3 text-[14px] leading-snug text-ink-900">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            aria-labelledby="agree-terms-label"
            className="mt-0.5 size-5 shrink-0 accent-brand-800"
          />
          <span id="agree-terms-label">{c.agreeTerms}</span>
        </label>
        <label className="flex cursor-pointer gap-3 text-[14px] leading-snug text-ink-900">
          <input
            type="checkbox"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            aria-labelledby="agree-privacy-label"
            className="mt-0.5 size-5 shrink-0 accent-brand-800"
          />
          <span id="agree-privacy-label">
            {c.agreePrivacy}
            {hasTenantDetails && c.tenantClause}
          </span>
        </label>
        <ErrorNote error={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 rounded-[10px]" onClick={close} disabled={pending}>
            {c.back}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-[10px] text-[15px]"
            disabled={!terms || !privacy || pending}
            onClick={agree}
          >
            {pending && <Spinner />}
            {c.agree}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** The booking form in a modal — mounted only when someone presses a booking button. */
export function BookingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy(COPY);
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} labelledBy="booking-dialog-title" className="sm:max-w-5xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 sm:px-7 sm:py-5">
        <div>
          <h2 id="booking-dialog-title" className="text-[20px] font-bold text-ink-900 sm:text-[24px]">
            {c.dialogTitle}
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-500 sm:text-[14px]">{c.dialogIntro}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={c.closeDialog}
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 sm:bg-canvas sm:px-7 sm:py-6">
        <BookingForm />
      </div>
    </Modal>
  );
}

/** Open state for the booking dialog, plus support for `?book` / `#book` deep links. */
export function useBookingDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.hash === "#book" || url.searchParams.has("book")) {
      setOpen(true);
      url.hash = "";
      url.searchParams.delete("book");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
  }, []);
  return {
    open,
    show: useCallback(() => setOpen(true), []),
    hide: useCallback(() => setOpen(false), []),
  };
}
