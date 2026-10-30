import {
  BOOKING_TERMS,
  KEY_POINTS,
  LEGAL_UPDATED,
  PRIVACY_NOTICE,
  type LegalSection,
} from "../../api/lib/booking-terms";
import {
  BOOKING_TERMS_ES,
  KEY_POINTS_ES,
  LEGAL_UPDATED_ES,
  PRIVACY_NOTICE_ES,
  TRANSLATION_NOTICE_ES,
} from "../../api/lib/booking-terms-es";
import type { Lang } from "./i18n";

export type LegalDocs = {
  keyPoints: string[];
  terms: LegalSection[];
  privacy: LegalSection[];
  updated: string;
  /** Present only on translations — the English text governs. */
  translationNotice: string | null;
};

const DOCS: Record<Lang, LegalDocs> = {
  en: {
    keyPoints: KEY_POINTS,
    terms: BOOKING_TERMS,
    privacy: PRIVACY_NOTICE,
    updated: LEGAL_UPDATED,
    translationNotice: null,
  },
  es: {
    keyPoints: KEY_POINTS_ES,
    terms: BOOKING_TERMS_ES,
    privacy: PRIVACY_NOTICE_ES,
    updated: LEGAL_UPDATED_ES,
    translationNotice: TRANSLATION_NOTICE_ES,
  },
};

export function legalDocs(lang: Lang): LegalDocs {
  return DOCS[lang];
}
