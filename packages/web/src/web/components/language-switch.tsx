import { Languages } from "lucide-react";
import { LANGS, useLang, type Lang } from "../lib/i18n";
import { cn } from "@/lib/utils";

const LABEL: Record<Lang, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  es: { short: "ES", name: "Español" },
};

/** Two-option EN / ES toggle for the public pages. */
export function LanguageSwitch({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <fieldset
      aria-label={lang === "es" ? "Idioma" : "Language"}
      className={cn(
        "m-0 inline-flex min-w-0 items-center gap-0.5 rounded-full border p-0.5 text-[12px] font-semibold",
        tone === "dark" ? "border-ink-200 bg-white" : "border-white/20 bg-white/5",
        className,
      )}
    >
      <Languages className={cn("ml-1.5 mr-0.5 size-3.5", tone === "dark" ? "text-ink-500" : "text-white/60")} aria-hidden />
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          aria-label={LABEL[l].name}
          title={LABEL[l].name}
          onClick={() => setLang(l)}
          className={cn(
            "min-h-8 min-w-9 rounded-full px-2 transition-colors",
            lang === l
              ? tone === "dark"
                ? "bg-brand-800 text-white"
                : "bg-white text-brand-800"
              : tone === "dark"
                ? "text-ink-700 hover:text-brand-800"
                : "text-white/75 hover:text-white",
          )}
        >
          {LABEL[l].short}
        </button>
      ))}
    </fieldset>
  );
}
