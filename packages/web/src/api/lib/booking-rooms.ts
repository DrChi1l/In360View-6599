/** Room counts offered on the public booking form — the top option means "or more". */
export const BEDROOM_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;
export const BATHROOM_OPTIONS = [1, 2, 3, 4, 5] as const;
export const RECEPTION_OPTIONS = [0, 1, 2, 3, 4] as const;

export const MAX_BEDROOMS = BEDROOM_OPTIONS[BEDROOM_OPTIONS.length - 1];
export const MAX_BATHROOMS = BATHROOM_OPTIONS[BATHROOM_OPTIONS.length - 1];
export const MAX_RECEPTION = RECEPTION_OPTIONS[RECEPTION_OPTIONS.length - 1];

const WORDS = {
  en: { studio: "Studio", bed: ["bedroom", "bedrooms"], bath: ["bathroom", "bathrooms"], rec: ["reception room", "reception rooms"] },
  es: { studio: "Estudio", bed: ["dormitorio", "dormitorios"], bath: ["baño", "baños"], rec: ["salón", "salones"] },
} as const;

/** Summary such as "Studio · 1 bathroom · 0 reception rooms" or "6+ bedrooms · …". English for the office. */
export function roomsSummary(
  r: { bedrooms?: number | null; bathrooms?: number | null; receptionRooms?: number | null },
  lang: "en" | "es" = "en",
) {
  if (r.bedrooms == null && r.bathrooms == null && r.receptionRooms == null) return null;
  const w = WORDS[lang];
  const n = (v: number, max: number, [one, many]: readonly [string, string]) =>
    `${v}${v >= max ? "+" : ""} ${v === 1 ? one : many}`;
  return [
    r.bedrooms == null ? null : r.bedrooms === 0 ? w.studio : n(r.bedrooms, MAX_BEDROOMS, w.bed),
    r.bathrooms == null ? null : n(r.bathrooms, MAX_BATHROOMS, w.bath),
    r.receptionRooms == null ? null : n(r.receptionRooms, MAX_RECEPTION, w.rec),
  ]
    .filter(Boolean)
    .join(" · ");
}
