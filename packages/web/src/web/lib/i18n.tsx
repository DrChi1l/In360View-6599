import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Public-site language. English is the default; Spanish is offered on the
 * marketing pages, price list, terms and booking pop-up. The staff app stays
 * in English.
 *
 * Resolution order on first load: `?lang=es|en` in the URL, a saved choice,
 * then the browser language. A choice made with the switcher is remembered.
 */
export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];
const STORAGE_KEY = "in360view.lang";

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "es";
}

function readStored(): Lang | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

function store(lang: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Private mode — the choice simply isn't remembered.
  }
}

/** Runs once, before any redirect can drop the query string. */
function initialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("lang");
  if (isLang(fromUrl)) {
    store(fromUrl);
    url.searchParams.delete("lang");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    return fromUrl;
  }
  if (window.location.pathname === "/es" || window.location.pathname.startsWith("/es/")) {
    store("es");
    return "es";
  }
  const stored = readStored();
  if (stored) return stored;
  const nav = (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase();
  return nav.startsWith("es") ? "es" : "en";
}

type LangContextValue = { lang: Lang; setLang: (lang: Lang) => void };
const LangContext = createContext<LangContextValue>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((next: Lang) => {
    store(next);
    setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "es" ? "es" : "en-GB";
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Pick the copy for the current language from an `{ en, es }` table. */
export function useCopy<T>(table: { en: T; es: T }): T {
  return table[useLang().lang];
}

/** BCP-47 locale for dates and numbers. */
export function localeFor(lang: Lang) {
  return lang === "es" ? "es-ES" : "en-GB";
}

/** Sets the tab title for public pages in the current language. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
