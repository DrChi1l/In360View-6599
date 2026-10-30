import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "../components/logo";
import { LegalText } from "../components/legal-text";
import { LanguageSwitch } from "../components/language-switch";
import { useCopy, useDocumentTitle, useLang } from "../lib/i18n";
import { legalDocs } from "../lib/legal";
import { BOOKING_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from "../../api/lib/booking-terms";

const COPY = {
  en: {
    docTitle: "Booking terms & privacy · In360View",
    navTerms: "Terms",
    navPrivacy: "Privacy",
    back: "Back to home",
    title: "Booking terms & privacy",
    updated: "Last updated",
    keyPoints: "Key points",
    termsTitle: "Booking Terms and Conditions",
    privacyTitle: "Privacy & Data Retention Notice",
    version: "Version",
  },
  es: {
    docTitle: "Condiciones de reserva y privacidad · In360View",
    navTerms: "Condiciones",
    navPrivacy: "Privacidad",
    back: "Volver al inicio",
    title: "Condiciones de reserva y privacidad",
    updated: "Última actualización:",
    keyPoints: "Puntos clave",
    termsTitle: "Condiciones de Reserva",
    privacyTitle: "Aviso de Privacidad y Conservación de Datos",
    version: "Versión",
  },
};

/** Public, linkable copy of the documents agreed to in the booking pop-up. */
export default function Terms() {
  const { lang } = useLang();
  const c = useCopy(COPY);
  const docs = legalDocs(lang);
  useDocumentTitle(c.docTitle);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="min-w-0 shrink">
            <Logo size={26} withTagline />
          </Link>
          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <nav className="hidden items-center gap-5 text-[14px] font-medium text-ink-700 sm:flex">
              <a href="#terms" className="hover:text-brand-800">
                {c.navTerms}
              </a>
              <a href="#privacy" className="hover:text-brand-800">
                {c.navPrivacy}
              </a>
            </nav>
            <LanguageSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-800"
        >
          <ArrowLeft className="size-4" /> {c.back}
        </Link>
        <h1 className="text-[32px] font-bold leading-tight text-ink-900 sm:text-[40px]">{c.title}</h1>
        <p className="mt-2 text-[14px] text-ink-500">
          {c.updated} {docs.updated}
        </p>

        {docs.translationNotice && (
          <p className="mt-6 rounded-[12px] border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-ink-700">
            {docs.translationNotice}
          </p>
        )}

        <nav className="mt-6 flex gap-4 text-[14px] font-medium text-brand-800 sm:hidden">
          <a href="#terms">{c.navTerms}</a>
          <a href="#privacy">{c.navPrivacy}</a>
        </nav>

        <div className="mt-8 rounded-[16px] border border-ink-100 bg-canvas p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold text-ink-900">{c.keyPoints}</h2>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-[14px] leading-relaxed text-ink-700 marker:text-brand-500">
            {docs.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <section id="terms" className="mt-12 scroll-mt-24">
          <h2 className="text-[24px] font-bold text-ink-900">{c.termsTitle}</h2>
          <p className="mb-6 mt-1 text-[12px] text-ink-500">
            {c.version} {BOOKING_TERMS_VERSION}
          </p>
          <LegalText sections={docs.terms} />
        </section>

        <section id="privacy" className="mt-14 scroll-mt-24">
          <h2 className="text-[24px] font-bold text-ink-900">{c.privacyTitle}</h2>
          <p className="mb-6 mt-1 text-[12px] text-ink-500">
            {c.version} {PRIVACY_NOTICE_VERSION}
          </p>
          <LegalText sections={docs.privacy} />
        </section>
      </main>
    </div>
  );
}
