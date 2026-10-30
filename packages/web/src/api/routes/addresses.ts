import { z } from "zod";
import { base } from "../__core/app";
import {
  normaliseCandidate,
  normalisePhoton,
  type CartoCiudadCandidate,
  type PhotonFeature,
  type SpanishAddressSuggestion,
} from "../lib/spain-address";

/**
 * Address lookup for the public booking form.
 *
 * Spain: CartoCiudad (Instituto Geográfico Nacional) — free, keyless, official.
 * Searches by street, number and municipality, which is how Spanish addresses
 * are found; the postcode is optional.
 *
 * Fallback: Photon (OpenStreetMap, komoot) — used when CartoCiudad is down or
 * finds nothing. After a CartoCiudad failure it is skipped for a few minutes so
 * every keystroke doesn't wait on a timeout.
 */
const CARTOCIUDAD = "https://www.cartociudad.es/geocoder/api/geocoder/candidates";
const PHOTON = "https://photon.komoot.io/api/";
/** Spain incl. the Balearic and Canary Islands, Ceuta and Melilla. */
const SPAIN_BBOX = "-18.4,27.5,4.6,43.9";
const USER_AGENT = "In360View booking form (+https://in360view.co.uk)";
const TTL_MS = 10 * 60 * 1000;
const CARTO_COOLDOWN_MS = 5 * 60 * 1000;
let cartoDownUntil = 0;
const cache = new Map<string, { at: number; results: SpanishAddressSuggestion[] }>();

function dedupe(list: (SpanishAddressSuggestion | null)[]) {
  const seen = new Set<string>();
  const results: SpanishAddressSuggestion[] = [];
  for (const s of list) {
    if (!s) continue;
    const dedupe = `${s.label}|${s.municipality}|${s.postalCode}`.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    results.push(s);
    if (results.length >= 6) break;
  }
  return results;
}

async function fromCartoCiudad(q: string) {
  const url = `${CARTOCIUDAD}?limit=10&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(4000),
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`CartoCiudad ${res.status}`);
  const raw = (await res.json()) as CartoCiudadCandidate[];
  return dedupe((Array.isArray(raw) ? raw : []).map(normaliseCandidate));
}

async function fromPhoton(q: string) {
  const url = `${PHOTON}?limit=12&bbox=${SPAIN_BBOX}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const raw = (await res.json()) as { features?: PhotonFeature[] };
  return dedupe((raw.features ?? []).map(normalisePhoton));
}

async function searchSpain(q: string): Promise<SpanishAddressSuggestion[]> {
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.results;

  let results: SpanishAddressSuggestion[] = [];
  let failures = 0;
  if (Date.now() >= cartoDownUntil) {
    try {
      results = await fromCartoCiudad(q);
    } catch (error) {
      failures++;
      cartoDownUntil = Date.now() + CARTO_COOLDOWN_MS;
      console.warn("[addresses] CartoCiudad unavailable, using OpenStreetMap", (error as Error).message);
    }
  }
  if (!results.length) {
    try {
      results = await fromPhoton(q);
    } catch (error) {
      failures++;
      console.warn("[addresses] Photon unavailable", (error as Error).message);
      if (failures === 2 || Date.now() < cartoDownUntil) throw error;
    }
  }

  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), results });
  return results;
}

export const addresses = {
  /** Public — used by the booking form when the property is in Spain. */
  searchEs: base
    .input(z.object({ q: z.string().trim().min(3).max(120) }))
    .handler(async ({ input }) => {
      try {
        return { results: await searchSpain(input.q), available: true };
      } catch (error) {
        console.error("[addresses] Spanish address search failed", error);
        // The form still works — the fields can be filled in by hand.
        return { results: [] as SpanishAddressSuggestion[], available: false };
      }
    }),
};
