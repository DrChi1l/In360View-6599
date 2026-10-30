import { Link } from "wouter";
import { ArrowLeft, CalendarClock, Download } from "lucide-react";
import { Logo } from "../components/logo";
import { Button } from "../components/ui/button";
import { BookingDialog, useBookingDialog } from "../components/booking-dialog";
import { LanguageSwitch } from "../components/language-switch";
import { useCopy, useDocumentTitle } from "../lib/i18n";

/** Served straight from public/ so the click is a plain browser download. */
const PRICE_LIST_PDF = "/in360view-price-list.pdf";

const COPY = {
  en: {
    docTitle: "Price list — In360View",
    home: "Home",
    prices: "Price list",
    book: "Book an inspection",
    back: "Back to home",
    eyebrow: "Inventories · Inspections · Reports",
    intro:
      "Check-in and check-out inventory rates by area and property size, covering Buckinghamshire, Berkshire and the Ealing Borough, plus the additional charges for same-day work, 360° virtual tours and extra rooms. Six bedrooms and above, large properties and HMOs, and travel outside the standard areas are quoted on request. Click the sheet to download it as a PDF, or use the buttons below to open or save it on your phone.",
    englishOnly: null as string | null,
    openPdf: "Open PDF",
    downloadPdf: "Download PDF",
    downloadAria: "Download the In360View price list as a PDF",
    alt: "In360View price list: check-in and check-out inventory rates by bedroom count for Buckinghamshire, Berkshire and the Ealing Borough, with additional charges for same-day inspections, same-day check-ins, 360-degree virtual tours and extra bedrooms or bathrooms",
    captionA: "Click the price list to download the PDF, or",
    captionLink: "download it here",
    readyTitle: "Ready to book?",
    readyBody: "Pick a date and we will confirm the visit by email.",
    footer: "In360View · Inventories, Inspections, Reports ·",
    terms: "Terms & privacy",
  },
  es: {
    docTitle: "Lista de precios — In360View",
    home: "Inicio",
    prices: "Precios",
    book: "Reservar una inspección",
    back: "Volver al inicio",
    eyebrow: "Inventarios · Inspecciones · Informes",
    intro:
      "Tarifas de inventarios de entrada y de salida según la zona y el tamaño del inmueble, para Buckinghamshire, Berkshire y el distrito de Ealing, además de los cargos adicionales por trabajos en el mismo día, visitas virtuales en 360° y estancias adicionales. Para inmuebles de seis dormitorios o más, inmuebles grandes y HMO (viviendas compartidas), y para desplazamientos fuera de las zonas habituales, se elabora un presupuesto a medida. Haga clic en la tabla para descargarla en PDF, o use los botones de abajo para abrirla o guardarla en el móvil.",
    englishOnly: "La lista de precios está en inglés. Los importes están en libras esterlinas (£).",
    openPdf: "Abrir PDF",
    downloadPdf: "Descargar PDF",
    downloadAria: "Descargar la lista de precios de In360View en PDF",
    alt: "Lista de precios de In360View: tarifas de inventarios de entrada y salida según el número de dormitorios para Buckinghamshire, Berkshire y el distrito de Ealing, con cargos adicionales por inspecciones y entradas en el mismo día, visitas virtuales en 360 grados y dormitorios o baños adicionales",
    captionA: "Haga clic en la lista de precios para descargar el PDF, o",
    captionLink: "descárguela aquí",
    readyTitle: "¿Listo para reservar?",
    readyBody: "Elija una fecha y le confirmaremos la visita por correo electrónico.",
    footer: "In360View · Inventarios, inspecciones e informes ·",
    terms: "Condiciones y privacidad",
  },
};

/**
 * Public price list. The rates themselves are the supplied artwork — one
 * authoritative image rather than a table that could drift out of step with
 * the printed sheet the office sends out.
 */
export default function Prices() {
  const booking = useBookingDialog();
  const c = useCopy(COPY);
  useDocumentTitle(c.docTitle);
  return (
    <div className="min-h-screen bg-white">
      <BookingDialog open={booking.open} onClose={booking.hide} />
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="shrink-0">
            <Logo size={26} withTagline />
          </Link>
          <nav className="hidden items-center gap-7 text-[14px] font-medium text-ink-700 md:flex">
            <Link href="/" className="hover:text-brand-800">
              {c.home}
            </Link>
            <span className="text-brand-800">{c.prices}</span>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitch />
            <Button size="sm" className="hidden sm:inline-flex" onClick={booking.show}>
              <CalendarClock className="size-4" />
              {c.book}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-800"
        >
          <ArrowLeft className="size-4" />
          {c.back}
        </Link>

        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-brand-800">
          {c.eyebrow}
        </p>
        <h1 className="mt-2 text-[34px] leading-[1.1] font-bold text-ink-900 sm:text-[44px]">
          {c.prices}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">
          {c.intro}
        </p>
        {c.englishOnly && <p className="mt-2 text-[13px] font-medium text-ink-500">{c.englishOnly}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          <a href={PRICE_LIST_PDF} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-800 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">
            <Download className="size-4" /> {c.openPdf}
          </a>
          <a href={PRICE_LIST_PDF} download="In360View-Price-List.pdf" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink-200 px-5 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-50">
            <Download className="size-4" /> {c.downloadPdf}
          </a>
        </div>

        <figure className="mt-8">
          <a
            href={PRICE_LIST_PDF}
            download="In360View-Price-List.pdf"
            aria-label={c.downloadAria}
            className="group relative block overflow-hidden rounded-[18px] border border-ink-100 bg-brand-50 shadow-soft transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            <img
              src="/images/price-list.png"
              alt={c.alt}
              className="block w-full"
              width={2340}
              height={1655}
            />
            <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-ink-900/90 px-3.5 py-2 text-[13px] font-medium text-white shadow-soft backdrop-blur transition group-hover:bg-ink-900">
              <Download className="size-4" />
              {c.downloadPdf}
            </span>
          </a>
          <figcaption className="mt-3 text-[13px] text-ink-500">
            {c.captionA}{" "}
            <a
              href={PRICE_LIST_PDF}
              download="In360View-Price-List.pdf"
              className="font-medium text-brand-800 underline underline-offset-2 hover:text-brand-900"
            >
              {c.captionLink}
            </a>
            .
          </figcaption>
        </figure>

        <div className="mt-8 flex flex-col gap-3 rounded-[18px] border border-ink-100 bg-white p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-ink-900">{c.readyTitle}</h2>
            <p className="mt-1 text-[14px] text-ink-700">{c.readyBody}</p>
          </div>
          <Button className="shrink-0" onClick={booking.show}>
            <CalendarClock className="size-4" />
            {c.book}
          </Button>
        </div>
      </main>

      <footer className="border-t border-ink-100 py-8">
        <p className="mx-auto max-w-6xl px-5 text-[13px] text-ink-500">
          {c.footer}{" "}
          <Link href="/terms" className="font-medium text-brand-800 hover:underline">
            {c.terms}
          </Link>
        </p>
      </footer>
    </div>
  );
}
