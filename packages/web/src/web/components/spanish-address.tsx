import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2, MapPin, Search } from "lucide-react";
import { orpc } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Field, Input, Label, Select } from "./ui/field";
import { cn } from "@/lib/utils";
import {
  SPANISH_PROVINCES,
  postcodeMatchesProvince,
  type SpanishAddressSuggestion,
} from "../../api/lib/spain-address";

/** Form state — strings throughout so inputs stay controlled. */
export type SpanishAddressDraft = {
  street: string;
  number: string;
  unit: string;
  locality: string;
  municipality: string;
  provinceCode: string;
  postalCode: string;
  catastralRef: string | null;
  lat: number | null;
  lng: number | null;
};

export const EMPTY_SPANISH_ADDRESS: SpanishAddressDraft = {
  street: "",
  number: "",
  unit: "",
  locality: "",
  municipality: "",
  provinceCode: "",
  postalCode: "",
  catastralRef: null,
  lat: null,
  lng: null,
};

export function spanishDraftToInput(d: SpanishAddressDraft) {
  return {
    street: d.street.trim(),
    number: d.number.trim(),
    unit: d.unit.trim() || null,
    locality: d.locality.trim() || null,
    municipality: d.municipality.trim(),
    provinceCode: d.provinceCode,
    postalCode: d.postalCode.trim() || null,
    catastralRef: d.catastralRef,
    lat: d.lat,
    lng: d.lng,
  };
}

const COPY = {
  en: {
    search: "Find the address",
    searchPlaceholder: "e.g. Calle Mayor 12, Madrid",
    searchHint: "Spanish addresses are found by street, number and municipality — no postcode needed.",
    searching: "Searching…",
    none: "No match. Try adding the town, or fill in the fields below.",
    unavailable: "Address search is unavailable right now — please fill in the fields below.",
    streetOnly: "Street — add the number",
    street: "Street *",
    streetPlaceholder: "Calle, Avenida, Plaza…",
    number: "Number *",
    numberHint: "Or s/n",
    unit: "Block / floor / door",
    unitPlaceholder: "e.g. Esc. 2, 3º B · Bajo A",
    unitHint: "For flats, the floor and door.",
    locality: "Urbanisation / village",
    municipality: "Municipality *",
    province: "Province *",
    choose: "Choose…",
    postalCode: "Postcode (optional)",
    postalWrong: "This postcode belongs to a different province.",
    found: "Address located on the map",
    foundOfficial: "Building found in the official street map (CartoCiudad)",
    catastral: "Catastral ref.",
    results: "Address suggestions",
    count: (n: number) => `${n} suggestion${n === 1 ? "" : "s"} — use the arrow keys and Enter to choose`,
  },
  es: {
    search: "Buscar la dirección",
    searchPlaceholder: "p. ej., Calle Mayor 12, Madrid",
    searchHint: "En España la dirección se busca por calle, número y municipio; no hace falta el código postal.",
    searching: "Buscando…",
    none: "Sin resultados. Añada el municipio o rellene los campos de abajo.",
    unavailable: "La búsqueda no está disponible ahora mismo; rellene los campos de abajo.",
    streetOnly: "Calle: añada el número",
    street: "Vía *",
    streetPlaceholder: "Calle, Avenida, Plaza…",
    number: "Número *",
    numberHint: "O s/n",
    unit: "Bloque / escalera / piso / puerta",
    unitPlaceholder: "p. ej., Esc. 2, 3º B · Bajo A",
    unitHint: "En pisos, indique planta y puerta.",
    locality: "Urbanización / pedanía",
    municipality: "Municipio *",
    province: "Provincia *",
    choose: "Elija…",
    postalCode: "Código postal (opcional)",
    postalWrong: "Este código postal es de otra provincia.",
    found: "Dirección localizada en el mapa",
    foundOfficial: "Edificio localizado en el callejero oficial (CartoCiudad)",
    catastral: "Ref. catastral",
    results: "Sugerencias de dirección",
    count: (n: number) => `${n} ${n === 1 ? "sugerencia" : "sugerencias"}; use las flechas e Intro para elegir`,
  },
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Spanish address entry: search the official street map (CartoCiudad) by
 * street + number + municipality, then confirm the structured fields. The
 * fields can always be filled in by hand.
 */
export function SpanishAddressFields({
  value,
  onChange,
}: {
  value: SpanishAddressDraft;
  onChange: (next: SpanishAddressDraft) => void;
}) {
  const { lang } = useLang();
  const c = COPY[lang];
  const id = useId();
  const listId = `${id}-list`;
  const numberRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(query.trim(), 280);

  const search = useQuery({
    ...orpc.addresses.searchEs.queryOptions({ input: { q } }),
    enabled: q.length >= 3,
    staleTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
  const results = q.length >= 3 ? (search.data?.results ?? []) : [];
  const waiting = query.trim().length >= 3 && (query.trim() !== q || search.isFetching);
  const showList = open && query.trim().length >= 3;

  useEffect(() => setActive(0), [q]);

  function pick(s: SpanishAddressSuggestion) {
    onChange({
      street: s.street,
      number: s.number,
      unit: value.unit,
      locality: s.locality ?? "",
      municipality: s.municipality,
      provinceCode: s.provinceCode,
      postalCode: s.postalCode,
      catastralRef: s.catastralRef,
      lat: s.lat,
      lng: s.lng,
    });
    setQuery("");
    setOpen(false);
    if (!s.number) requestAnimationFrame(() => numberRef.current?.focus());
  }

  /** Editing the street, number or town by hand means the map match no longer applies. */
  const edit = (key: keyof SpanishAddressDraft, resetsMatch = false) => (v: string) =>
    onChange({ ...value, [key]: v, ...(resetsMatch ? { catastralRef: null, lat: null, lng: null } : {}) });

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList || !results.length) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      // Never submit the booking form from the search box.
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    }
  }

  const postalWrong = !postcodeMatchesProvince(value.postalCode.trim(), value.provinceCode);
  const located = value.lat != null && value.lng != null;

  return (
    <div className="grid gap-3.5 rounded-[12px] border border-ink-100 bg-canvas/60 p-3.5 sm:p-4">
      <div className="relative">
        <Label htmlFor={`${id}-search`}>{c.search}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
          <Input
            id={`${id}-search`}
            aria-controls={listId}
            aria-describedby={`${id}-status`}
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            placeholder={c.searchPlaceholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            className="pl-9 pr-9"
          />
          {waiting && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-300" />
          )}
        </div>
        <p className="mt-1 text-[12px] text-ink-500">{c.searchHint}</p>
        <p id={`${id}-status`} aria-live="polite" className="sr-only">
          {showList && !waiting ? (results.length ? c.count(results.length) : c.none) : ""}
        </p>

        {showList && (
          <div className="absolute inset-x-0 top-[70px] z-20 overflow-hidden rounded-[12px] border border-ink-200 bg-white shadow-soft">
            {results.length > 0 ? (
              <ul id={listId} aria-label={c.results} className="max-h-72 overflow-y-auto py-1">
                {results.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(s)}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
                        i === active ? "bg-brand-50" : "bg-white",
                      )}
                    >
                      {s.kind === "portal" ? (
                        <Building2 className="mt-0.5 size-4 shrink-0 text-brand-500" />
                      ) : (
                        <MapPin className="mt-0.5 size-4 shrink-0 text-ink-300" />
                      )}
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-ink-900">{s.label}</span>
                        <span className="block text-[12px] text-ink-500">
                          {s.kind === "street" ? `${c.streetOnly} · ` : ""}
                          {s.detail}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p id={listId} className="px-3 py-3 text-[13px] text-ink-500">
                {waiting ? c.searching : search.data && !search.data.available ? c.unavailable : c.none}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <Field label={c.street} htmlFor={`${id}-street`}>
          <Input
            id={`${id}-street`}
            value={value.street}
            onChange={(e) => edit("street", true)(e.target.value)}
            placeholder={c.streetPlaceholder}
            autoComplete="address-line1"
            required
          />
        </Field>
        <Field label={c.number} hint={c.numberHint} htmlFor={`${id}-number`}>
          <Input
            id={`${id}-number`}
            ref={numberRef}
            value={value.number}
            onChange={(e) => edit("number", true)(e.target.value)}
            inputMode="text"
            maxLength={20}
            required
          />
        </Field>
      </div>
      <Field label={c.unit} hint={c.unitHint} htmlFor={`${id}-unit`}>
        <Input
            id={`${id}-unit`}
          value={value.unit}
          onChange={(e) => edit("unit")(e.target.value)}
          placeholder={c.unitPlaceholder}
          autoComplete="address-line2"
          maxLength={60}
        />
      </Field>
      {value.locality && (
        <Field label={c.locality} htmlFor={`${id}-locality`}>
          <Input
            id={`${id}-locality`} value={value.locality} onChange={(e) => edit("locality")(e.target.value)} maxLength={120} />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={c.municipality} htmlFor={`${id}-municipality`}>
          <Input
            id={`${id}-municipality`}
            value={value.municipality}
            onChange={(e) => edit("municipality", true)(e.target.value)}
            autoComplete="address-level2"
            required
          />
        </Field>
        <Field label={c.province} htmlFor={`${id}-province`}>
          <Select
            id={`${id}-province`}
            value={value.provinceCode}
            onChange={(e) => edit("provinceCode")(e.target.value)}
            autoComplete="address-level1"
            required
          >
            <option value="" disabled>
              {c.choose}
            </option>
            {SPANISH_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={c.postalCode} error={postalWrong ? c.postalWrong : null} htmlFor={`${id}-postal`}>
        <Input
            id={`${id}-postal`}
          value={value.postalCode}
          onChange={(e) => edit("postalCode")(e.target.value.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          pattern="\d{5}"
          autoComplete="postal-code"
          className="max-w-[9rem] tabular-nums"
          aria-invalid={postalWrong || undefined}
        />
      </Field>
      {located && (
        <p className="flex items-center gap-1.5 text-[12px] text-ok">
          <Building2 className="size-3.5" />
          {value.catastralRef ? c.foundOfficial : c.found}
          {value.catastralRef && (
            <span className="text-ink-500">
              {" "}
              · {c.catastral} {value.catastralRef}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
