import { z } from "zod";

/**
 * Spanish property addresses.
 *
 * In Spain a property is found by street + number + municipality, not by
 * postcode: the código postal (5 digits) is secondary, often unknown to the
 * person booking, and covers whole districts. Flats are identified by floor and
 * door ("3º B", "Bajo A", "Esc. 2, 1º 4ª"). The official geocoder is the IGN's
 * CartoCiudad, which also returns the building's catastral reference.
 *
 * Shared by the booking API and the booking form.
 */

/** The 50 provinces plus Ceuta and Melilla, keyed by INE code — also the first two digits of every postcode. */
export const SPANISH_PROVINCES: { code: string; name: string }[] = [
  { code: "01", name: "Araba/Álava" },
  { code: "02", name: "Albacete" },
  { code: "03", name: "Alicante/Alacant" },
  { code: "04", name: "Almería" },
  { code: "05", name: "Ávila" },
  { code: "06", name: "Badajoz" },
  { code: "07", name: "Illes Balears" },
  { code: "08", name: "Barcelona" },
  { code: "09", name: "Burgos" },
  { code: "10", name: "Cáceres" },
  { code: "11", name: "Cádiz" },
  { code: "12", name: "Castellón/Castelló" },
  { code: "13", name: "Ciudad Real" },
  { code: "14", name: "Córdoba" },
  { code: "15", name: "A Coruña" },
  { code: "16", name: "Cuenca" },
  { code: "17", name: "Girona" },
  { code: "18", name: "Granada" },
  { code: "19", name: "Guadalajara" },
  { code: "20", name: "Gipuzkoa" },
  { code: "21", name: "Huelva" },
  { code: "22", name: "Huesca" },
  { code: "23", name: "Jaén" },
  { code: "24", name: "León" },
  { code: "25", name: "Lleida" },
  { code: "26", name: "La Rioja" },
  { code: "27", name: "Lugo" },
  { code: "28", name: "Madrid" },
  { code: "29", name: "Málaga" },
  { code: "30", name: "Murcia" },
  { code: "31", name: "Navarra" },
  { code: "32", name: "Ourense" },
  { code: "33", name: "Asturias" },
  { code: "34", name: "Palencia" },
  { code: "35", name: "Las Palmas" },
  { code: "36", name: "Pontevedra" },
  { code: "37", name: "Salamanca" },
  { code: "38", name: "Santa Cruz de Tenerife" },
  { code: "39", name: "Cantabria" },
  { code: "40", name: "Segovia" },
  { code: "41", name: "Sevilla" },
  { code: "42", name: "Soria" },
  { code: "43", name: "Tarragona" },
  { code: "44", name: "Teruel" },
  { code: "45", name: "Toledo" },
  { code: "46", name: "Valencia/València" },
  { code: "47", name: "Valladolid" },
  { code: "48", name: "Bizkaia" },
  { code: "49", name: "Zamora" },
  { code: "50", name: "Zaragoza" },
  { code: "51", name: "Ceuta" },
  { code: "52", name: "Melilla" },
];

const PROVINCE_BY_CODE = new Map(SPANISH_PROVINCES.map((p) => [p.code, p.name]));

export function provinceName(code: string) {
  return PROVINCE_BY_CODE.get(code) ?? null;
}

export const PROPERTY_COUNTRIES = ["GB", "ES"] as const;
export type PropertyCountry = (typeof PROPERTY_COUNTRIES)[number];

export const spanishAddressSchema = z
  .object({
    /** Street type + name, e.g. "Calle Mayor", "Avinguda Diagonal". */
    street: z.string().trim().min(2, "Enter the street").max(160),
    /** Building number, or "s/n" (sin número). */
    number: z.string().trim().min(1, "Enter the building number, or s/n").max(20),
    /** Block / staircase / floor / door, e.g. "Esc. 2, 3º B". */
    unit: z.string().trim().max(60).optional().nullable(),
    /** Village, urbanisation or district when it differs from the municipality. */
    locality: z.string().trim().max(120).optional().nullable(),
    municipality: z.string().trim().min(2, "Enter the municipality").max(120),
    provinceCode: z.string().refine((c) => PROVINCE_BY_CODE.has(c), "Choose the province"),
    /** Optional in Spain — many people booking won't know it. */
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "A Spanish postcode has 5 digits")
      .optional()
      .nullable()
      .or(z.literal("")),
    /** Building-level catastral reference (14 characters) when picked from the search. */
    catastralRef: z.string().trim().max(20).optional().nullable(),
    lat: z.number().min(27).max(44).optional().nullable(),
    lng: z.number().min(-19).max(5).optional().nullable(),
  })
  .refine((a) => !a.postalCode || a.postalCode.slice(0, 2) === a.provinceCode, {
    message: "That postcode belongs to a different province",
    path: ["postalCode"],
  });

export type SpanishAddress = z.infer<typeof spanishAddressSchema>;

/** Postcodes start with the province code — used to flag typos before submitting. */
export function postcodeMatchesProvince(postalCode: string, provinceCode: string) {
  return !postalCode || !provinceCode || postalCode.slice(0, 2) === provinceCode;
}

function townLine(a: Pick<SpanishAddress, "municipality" | "provinceCode" | "postalCode">) {
  const province = provinceName(a.provinceCode);
  const sameName = province && province.toLowerCase().split("/").includes(a.municipality.trim().toLowerCase());
  const town = sameName || !province ? a.municipality.trim() : `${a.municipality.trim()} (${province})`;
  return a.postalCode ? `${a.postalCode} ${town}` : town;
}

/** One-line Spanish postal format: "Calle Mayor 12, 3º B, 28013 Madrid, España". */
export function formatSpanishAddress(a: SpanishAddress) {
  return [
    `${a.street.trim()} ${a.number.trim()}`,
    a.unit?.trim(),
    a.locality?.trim(),
    townLine(a),
    "España",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Split for the staff property record (line 1 / line 2 / town / postcode). */
export function spanishAddressToProperty(a: SpanishAddress) {
  return {
    addressLine1: `${a.street.trim()} ${a.number.trim()}`,
    addressLine2: [a.unit?.trim(), a.locality?.trim()].filter(Boolean).join(", ") || null,
    city: `${townLine({ ...a, postalCode: null })}, España`,
    postcode: a.postalCode || "—",
  };
}

export function mapLink(a: Pick<SpanishAddress, "lat" | "lng">) {
  return a.lat != null && a.lng != null ? `https://www.google.com/maps?q=${a.lat},${a.lng}` : null;
}

/* ------------------------------------------------------------------ */
/* CartoCiudad results                                                 */
/* ------------------------------------------------------------------ */

const SMALL_WORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "i", "en", "a", "al"]);
const ROMAN = /^(?=[mdclxvi])m*(c[md]|d?c{0,3})(x[cl]|l?x{0,3})(i[xv]|v?i{0,3})$/;

/** "CALLE DE ALFONSO XII" → "Calle de Alfonso XII", "CARRER D'ARAGO" → "Carrer d'Arago". */
export function titleCaseStreet(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      const elided = /^([dl])'(.+)$/.exec(word);
      if (elided) return `${elided[1]}'${elided[2].charAt(0).toUpperCase()}${elided[2].slice(1)}`;
      if (i > 0 && SMALL_WORDS.has(word)) return word;
      if (word.length > 1 && ROMAN.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export type CartoCiudadCandidate = {
  id: string;
  type: string;
  address: string;
  portalNumber?: number | null;
  extension?: string | null;
  postalCode?: string | null;
  poblacion?: string | null;
  muni?: string | null;
  province?: string | null;
  provinceCode?: string | null;
  refCatastral?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type SpanishAddressSuggestion = {
  id: string;
  /** "portal" = exact building; "street" = street only, the number still has to be typed. */
  kind: "portal" | "street";
  street: string;
  number: string;
  locality: string | null;
  municipality: string;
  provinceCode: string;
  postalCode: string;
  catastralRef: string | null;
  lat: number | null;
  lng: number | null;
  label: string;
  detail: string;
};

export function normaliseCandidate(c: CartoCiudadCandidate): SpanishAddressSuggestion | null {
  if (c.type !== "portal" && c.type !== "callejero") return null;
  const provinceCode = c.provinceCode ?? "";
  const municipality = c.muni?.trim() ?? "";
  if (!PROVINCE_BY_CODE.has(provinceCode) || !municipality) return null;

  const comma = c.address.lastIndexOf(",");
  let head = (comma > 0 ? c.address.slice(0, comma) : c.address).trim();
  let number = "";
  if (c.type === "portal" && c.portalNumber != null) {
    head = head.replace(new RegExp(`\\s+${c.portalNumber}(\\s.*)?$`), "").trim();
    const ext = c.extension?.trim();
    number = String(c.portalNumber) + (ext && /^(bis|[a-z])$/i.test(ext) ? ` ${ext.toUpperCase()}` : "");
  }
  const street = titleCaseStreet(head);
  if (!street) return null;

  // "Lagar de las Pitas (Alhaurín de la Torre)" → locality "Lagar de las Pitas"
  const poblacion = (c.poblacion ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
  const locality = poblacion && poblacion.toLowerCase() !== municipality.toLowerCase() ? poblacion : null;
  const postalCode = /^\d{5}$/.test(c.postalCode?.trim() ?? "") ? c.postalCode!.trim() : "";
  const province = provinceName(provinceCode)!;
  const place = [locality, municipality].filter(Boolean).join(", ");
  const showProvince = !province.toLowerCase().split("/").includes(municipality.toLowerCase());

  return {
    id: c.id,
    kind: c.type === "portal" ? "portal" : "street",
    street,
    number,
    locality,
    municipality,
    provinceCode,
    postalCode,
    catastralRef: c.type === "portal" ? (c.refCatastral ?? null) : null,
    lat: typeof c.lat === "number" ? c.lat : null,
    lng: typeof c.lng === "number" ? c.lng : null,
    label: number ? `${street} ${number}` : street,
    detail: [postalCode, showProvince ? `${place} (${province})` : place].filter(Boolean).join(" "),
  };
}

/* ------------------------------------------------------------------ */
/* Photon (OpenStreetMap) — fallback when CartoCiudad is unreachable   */
/* ------------------------------------------------------------------ */

export type PhotonFeature = {
  properties: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    locality?: string;
    district?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Single-province communities, where OSM's "state" is enough. */
const STATE_PROVINCE: [string, string][] = [
  ["madrid", "28"],
  ["asturias", "33"],
  ["cantabria", "39"],
  ["rioja", "26"],
  ["murcia", "30"],
  ["navarra", "31"],
  ["nafarroa", "31"],
  ["ceuta", "51"],
  ["melilla", "52"],
];

/** Province from the postcode prefix, else from OSM county / state names. */
export function guessProvinceCode(postcode?: string, county?: string, state?: string) {
  const prefix = postcode?.trim().slice(0, 2) ?? "";
  if (/^\d{5}$/.test(postcode?.trim() ?? "") && PROVINCE_BY_CODE.has(prefix)) return prefix;
  if (county) {
    const c = fold(county);
    const hit = SPANISH_PROVINCES.find((p) => fold(p.name).split("/").some((n) => c === n || c.includes(n)));
    if (hit) return hit.code;
  }
  if (state) {
    const s = fold(state);
    const hit = STATE_PROVINCE.find(([n]) => s.includes(n));
    if (hit) return hit[1];
  }
  return "";
}

export function normalisePhoton(f: PhotonFeature): SpanishAddressSuggestion | null {
  const p = f.properties;
  if (p.countrycode !== "ES") return null;
  const isHouse = p.type === "house" && Boolean(p.housenumber);
  const isStreet = p.type === "street" && p.osm_key === "highway";
  if (!isHouse && !isStreet) return null;
  const street = (isHouse ? p.street : p.name)?.trim();
  const municipality = (p.city ?? p.town ?? p.village)?.trim();
  if (!street || !municipality) return null;
  const provinceCode = guessProvinceCode(p.postcode, p.county, p.state);
  const postalCode = /^\d{5}$/.test(p.postcode?.trim() ?? "") ? p.postcode!.trim() : "";
  const number = isHouse ? p.housenumber!.trim() : "";
  const [lng, lat] = f.geometry?.coordinates ?? [];
  const province = provinceName(provinceCode);
  const showProvince = province && !province.toLowerCase().split("/").includes(municipality.toLowerCase());
  return {
    id: `osm:${p.osm_type ?? ""}${p.osm_id ?? `${street}|${number}|${municipality}`}`,
    kind: isHouse ? "portal" : "street",
    street,
    number,
    locality: null,
    municipality,
    provinceCode,
    postalCode,
    catastralRef: null,
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
    label: number ? `${street} ${number}` : street,
    detail: [postalCode, showProvince ? `${municipality} (${province})` : municipality].filter(Boolean).join(" "),
  };
}
