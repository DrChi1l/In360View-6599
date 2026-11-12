import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  CameraIcon,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Home,
  Mail,
  MapPin,
  PenLine,
  Phone,
  ScrollText,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Logo } from "../components/logo";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/field";
import { BookingDialog, useBookingDialog } from "../components/booking-dialog";
import { AuthDialog } from "../components/auth-dialog";
import { LanguageSwitch } from "../components/language-switch";
import { useCopy, useDocumentTitle } from "../lib/i18n";

const SERVICE_ICONS = [ClipboardList, ScrollText, Home, ShieldCheck];
const REASON_ICONS = [Zap, CameraIcon, PenLine, BadgeCheck, Clock, FileText];

type Item = { title: string; body: string };

const COPY = {
  en: {
    docTitle: "In360View — Property inventories, inspections & reports",
    nav: { services: "What we do", why: "Why us", prices: "Price list", pricesPdf: "Price list PDF", book: "Book", mine: "My bookings", signIn: "Sign in" },
    badge: "Inventories · Inspections · Reports",
    heroA: "Professional property inventories",
    heroB: "you can rely on",
    heroBody:
      "In360View gives UK landlords and letting agents fast, photo-backed inventory reports with digital signatures — book online in minutes.",
    heroCta: "Book an inspection",
    servicesTitle: "What we do",
    servicesIntro: "A complete inventory and inspection service for the rental sector.",
    services: [
      {
        title: "Check-In & Check-Out Inventories",
        body: "Detailed, room-by-room inventories that protect landlords and tenants at the start and end of every tenancy.",
      },
      {
        title: "Mid-Term Inspections",
        body: "Routine property visits to record condition, flag maintenance, and keep tenancies on track.",
      },
      {
        title: "Photographic Records",
        body: "Time-stamped photo evidence of every room and item, stored against the property for the whole tenancy.",
      },
      {
        title: "Compliance Tracking",
        body: "Gas, EICR, EPC and smoke/CO certificates tracked in one place with expiry reminders.",
      },
    ] as Item[],
    whyTitle: "Why choose our inventory company",
    whyIntro: "Built for speed, accuracy and total protection.",
    reasons: [
      {
        title: "Fast turnaround",
        body: "Digital, on-site reporting means reports are ready the same day — no paperwork delays.",
      },
      {
        title: "Photo-backed evidence",
        body: "Every item is documented with photos and defect flags, so nothing is left to interpretation.",
      },
      {
        title: "Digital signatures",
        body: "Tenants, landlords and clerks sign on device. A signed, court-ready PDF is generated instantly.",
      },
      {
        title: "Professional & insured",
        body: "Trained inventory clerks and fully insured visits give you complete peace of mind.",
      },
      {
        title: "Easy online booking",
        body: "Landlords and agents book directly from this page — pick a date, add the details, and we handle the rest.",
      },
      {
        title: "AI-ready reports",
        body: "Structured data behind every report makes comparisons, re-inspections and future automation effortless.",
      },
    ] as Item[],
    workflowTitle: "Inventories that stand up when the deposit is disputed.",
    workflowBody:
      "Clerks, agencies and landlords run their whole inspection workflow in In360View — on site, offline, and signed before they leave.",
    workflow: [
      "Check-In, Check-Out and Mid-Term inspections in one place",
      "Room-by-room condition and cleanliness, captured in taps",
      "Hundreds of photos per job — captured offline, synced later",
      "Professional PDF reports, signed on the spot and locked",
    ],
    footerBody:
      "Professional property inventories, inspections and condition reports for UK landlords, letting agents and inventory clerks.",
    contact: "Get in touch",
    country: "United Kingdom",
    bookings: "Bookings",
    footerBook: "Book an inspection",
    footerMine: "Check a booking",
    terms: "Terms & privacy",
    rights: "All rights reserved.",
  },
  es: {
    docTitle: "In360View — Inventarios, inspecciones e informes de inmuebles",
    nav: { services: "Servicios", why: "Por qué elegirnos", prices: "Precios", pricesPdf: "Precios en PDF", book: "Reservar", mine: "Mis reservas", signIn: "Iniciar sesión" },
    badge: "Inventarios · Inspecciones · Informes",
    heroA: "Inventarios profesionales de inmuebles",
    heroB: "en los que puede confiar",
    heroBody:
      "In360View ofrece a propietarios y agencias de alquiler del Reino Unido informes de inventario rápidos, respaldados con fotografías y con firma digital. Reserve por internet en minutos.",
    heroCta: "Reservar una inspección",
    servicesTitle: "Qué hacemos",
    servicesIntro: "Un servicio completo de inventarios e inspecciones para el sector del alquiler.",
    services: [
      {
        title: "Inventarios de entrada y salida",
        body: "Inventarios detallados, estancia por estancia, que protegen a propietarios e inquilinos al principio y al final de cada arrendamiento.",
      },
      {
        title: "Inspecciones intermedias",
        body: "Visitas periódicas para registrar el estado del inmueble, detectar necesidades de mantenimiento y mantener el arrendamiento en orden.",
      },
      {
        title: "Registros fotográficos",
        body: "Pruebas fotográficas con fecha y hora de cada estancia y elemento, guardadas con el inmueble durante todo el arrendamiento.",
      },
      {
        title: "Control de certificados",
        body: "Certificados de gas, EICR, EPC y detectores de humo y CO controlados en un solo lugar, con avisos de caducidad.",
      },
    ] as Item[],
    whyTitle: "Por qué elegir nuestra empresa de inventarios",
    whyIntro: "Pensada para la rapidez, la precisión y una protección total.",
    reasons: [
      {
        title: "Entrega rápida",
        body: "Los informes se elaboran en digital y en el propio inmueble, así que están listos el mismo día, sin retrasos por papeleo.",
      },
      {
        title: "Pruebas con fotografías",
        body: "Cada elemento se documenta con fotografías y marcas de desperfectos, para que nada quede a la interpretación.",
      },
      {
        title: "Firmas digitales",
        body: "Inquilinos, propietarios e inspectores firman en el dispositivo. Al instante se genera un PDF firmado, válido como prueba.",
      },
      {
        title: "Profesionales y asegurados",
        body: "Inspectores de inventario formados y visitas con seguro completo, para su total tranquilidad.",
      },
      {
        title: "Reserva fácil por internet",
        body: "Propietarios y agencias reservan directamente desde esta página: elija una fecha, añada los datos y nosotros nos encargamos del resto.",
      },
      {
        title: "Informes preparados para IA",
        body: "Los datos estructurados de cada informe facilitan las comparaciones, las reinspecciones y la automatización futura.",
      },
    ] as Item[],
    workflowTitle: "Inventarios que se sostienen cuando se disputa la fianza.",
    workflowBody:
      "Inspectores, agencias y propietarios gestionan todo su proceso de inspección en In360View: en el inmueble, sin conexión y con la firma hecha antes de irse.",
    workflow: [
      "Inspecciones de entrada, de salida e intermedias en un solo lugar",
      "Estado y limpieza de cada estancia, registrados con unos toques",
      "Cientos de fotos por trabajo, tomadas sin conexión y sincronizadas después",
      "Informes PDF profesionales, firmados en el momento y bloqueados",
    ],
    footerBody:
      "Inventarios, inspecciones e informes de estado profesionales para propietarios, agencias de alquiler e inspectores de inventario del Reino Unido.",
    contact: "Contacto",
    country: "Reino Unido",
    bookings: "Reservas",
    footerBook: "Reservar una inspección",
    footerMine: "Consultar una reserva",
    terms: "Condiciones y privacidad",
    rights: "Todos los derechos reservados.",
  },
};

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Landing() {
  const booking = useBookingDialog();
  const c = useCopy(COPY);
  useDocumentTitle(c.docTitle);
  const [location, setLocation] = useLocation();
  const [authOpen, setAuthOpen] = useState(location === "/sign-in");

  useEffect(() => {
    if (location === "/sign-in") setAuthOpen(true);
  }, [location]);

  function closeAuth() {
    setAuthOpen(false);
    if (location === "/sign-in") {
      setLocation("/", { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <BookingDialog open={booking.open} onClose={booking.hide} />
      <AuthDialog open={authOpen} onClose={closeAuth} />
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <button type="button" onClick={() => scrollTo("top")} className="shrink-0 text-left">
            <Logo size={26} withTagline />
          </button>
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-7 text-[14px] font-medium text-ink-700 md:flex">
              <button type="button" className="hover:text-brand-800" onClick={() => scrollTo("services")}>
                {c.nav.services}
              </button>
              <button type="button" className="hover:text-brand-800" onClick={() => scrollTo("why")}>
                {c.nav.why}
              </button>
              <Link href="/prices" className="hover:text-brand-800">
                {c.nav.prices}
              </Link>
              <Link href="/my-bookings" className="hover:text-brand-800">
                {c.nav.mine}
              </Link>
              <button type="button" className="hover:text-brand-800" onClick={booking.show}>
                {c.nav.book}
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-800 px-3.5 py-1.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-900"
                onClick={() => setAuthOpen(true)}
              >
                {c.nav.signIn}
              </button>
            </nav>
            <LanguageSwitch />
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="flex items-center justify-center gap-x-4 border-t border-ink-100 px-4 py-2 text-sm font-semibold text-brand-800 md:hidden">
          <Link href="/prices" className="inline-flex min-h-11 items-center">{c.nav.prices}</Link>
          <a href="/in360view-price-list.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2">
            <FileText className="size-4" /> {c.nav.pricesPdf}
          </a>
          <Link href="/my-bookings" className="inline-flex min-h-11 items-center">{c.nav.mine}</Link>
          <button type="button" className="min-h-11" onClick={booking.show}>{c.nav.book}</button>
          <button type="button" className="min-h-11 font-bold text-brand-900 underline" onClick={() => setAuthOpen(true)}>
            {c.nav.signIn}
          </button>
        </nav>
      </header>

      <section id="top" className="relative isolate overflow-hidden bg-brand-900">
        <img
          src="/images/hero-street.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover opacity-90"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,3,51,0.55)_0%,rgba(18,6,92,0.5)_55%,rgba(11,3,51,0.78)_100%)]"
        />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white/90">
            <span className="size-1.5 rounded-full bg-gold-400" />
            {c.badge}
          </span>
          <h1
            className="mt-6 text-[40px] font-extrabold leading-[1.08] text-white sm:text-[58px]"
          >
            {c.heroA}
            <span
              className="mt-1 block text-gold-400"
              style={{
                WebkitTextStroke: "1px rgba(250,249,255,0.95)",
                paintOrder: "stroke fill",
                textShadow: "0 1px 2px rgba(250,249,255,0.5)",
              }}
            >
              {c.heroB}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-white/80 sm:text-[17px]">
            {c.heroBody}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              className="h-12 rounded-[10px] bg-white px-6 text-[15px] font-bold text-gold-500 shadow-lg hover:bg-brand-50"
              onClick={booking.show}
            >
              {c.heroCta}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <section id="services" className="border-b border-ink-100 bg-white px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-[32px] font-bold text-ink-900 sm:text-[38px]">{c.servicesTitle}</h2>
          <p className="mt-2.5 text-center text-[15px] text-ink-500">{c.servicesIntro}</p>
          <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.services.map((s, i) => {
              const Icon = SERVICE_ICONS[i];
              return (
              <Card key={s.title} className="h-full p-5">
                <span className="grid size-11 place-items-center rounded-[12px] bg-brand-100 text-brand-800">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-[16px] font-semibold leading-snug text-ink-900">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-500">{s.body}</p>
              </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="why" className="border-b border-ink-100 bg-canvas px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-[32px] font-bold text-ink-900 sm:text-[38px]">
            {c.whyTitle}
          </h2>
          <p className="mt-2.5 text-center text-[15px] text-ink-500">{c.whyIntro}</p>
          <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.reasons.map((r, i) => {
              const Icon = REASON_ICONS[i];
              return (
              <Card key={r.title} className="flex h-full gap-3.5 p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-gold-100 text-gold-600">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-[16px] font-semibold text-ink-900">{r.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-500">{r.body}</p>
                </div>
              </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 bg-canvas px-5 py-20">
        <div className="mx-auto max-w-3xl">
          <div>
            <h2 className="text-[32px] font-bold leading-[1.15] text-ink-900 sm:text-[36px]">
              {c.workflowTitle}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-500">{c.workflowBody}</p>
            <ul className="mt-7 grid gap-3.5">
              {c.workflow.map((line) => (
                <li key={line} className="flex gap-3 text-[14px] text-ink-700">
                  <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-brand-500" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="bg-brand-900 px-5 py-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo size={24} tone="light" withTagline />
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/65">
              {c.footerBody}
            </p>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">{c.contact}</h3>
            <ul className="mt-4 grid gap-2.5 text-[14px] text-white/80">
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-white/50" />
                <a className="hover:text-white" href="mailto:in360view@outlook.com">
                  in360view@outlook.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 text-white/50" />
                <a className="hover:text-white" href="tel:07990060618">
                  07990 060618
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="size-4 text-white/50" />
                {c.country}
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">{c.bookings}</h3>
            <ul className="mt-4 grid gap-2.5 text-[14px] text-white/80">
              <li>
                <button type="button" className="hover:text-white" onClick={booking.show}>
                  {c.footerBook}
                </button>
              </li>
              <li>
                <Link href="/my-bookings" className="hover:text-white">
                  {c.footerMine}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  {c.terms}
                </Link>
              </li>
              <li>
                <button type="button" className="hover:text-white" onClick={() => setAuthOpen(true)}>
                  {c.nav.signIn}
                </button>
              </li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-[13px] text-white/45">
          © {new Date().getFullYear()} In360View. {c.rights}
        </p>
      </footer>
    </div>
  );
}
