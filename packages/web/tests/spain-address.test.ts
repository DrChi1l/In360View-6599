import { afterAll, expect, test } from "bun:test";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { eq } from "drizzle-orm";
import type { AppRouterClient } from "../src/api";
import { db } from "../src/api/database";
import * as schema from "../src/api/database/schema";
import { BOOKING_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from "../src/api/lib/booking-terms";
import {
  SPANISH_PROVINCES,
  formatSpanishAddress,
  guessProvinceCode,
  normaliseCandidate,
  normalisePhoton,
  spanishAddressSchema,
  spanishAddressToProperty,
  titleCaseStreet,
} from "../src/api/lib/spain-address";

const client: AppRouterClient = createORPCClient(new RPCLink({ url: "http://localhost:4200/api/rpc" }));
const TEST_EMAIL = "booking-terms-test@example.com";

afterAll(async () => {
  await db.delete(schema.bookingRequests).where(eq(schema.bookingRequests.contactEmail, TEST_EMAIL));
});

const madrid = {
  street: "Calle Mayor",
  number: "12",
  unit: "3º B",
  locality: null,
  municipality: "Madrid",
  provinceCode: "28",
  postalCode: "28013",
  catastralRef: "0144605VK4704C",
  lat: 40.4165,
  lng: -3.7061,
};

test("52 provinces with unique two-digit codes", () => {
  expect(SPANISH_PROVINCES.length).toBe(52);
  expect(new Set(SPANISH_PROVINCES.map((p) => p.code)).size).toBe(52);
});

test("street names are title-cased the Spanish way", () => {
  expect(titleCaseStreet("CALLE DE ALFONSO XII")).toBe("Calle de Alfonso XII");
  expect(titleCaseStreet("CARRER D'ARAGO")).toBe("Carrer d'Arago");
  expect(titleCaseStreet("CALLE DEL CID")).toBe("Calle del Cid");
});

test("CartoCiudad results become structured addresses", () => {
  const portal = normaliseCandidate({
    id: "x",
    type: "portal",
    address: "CALLE MAYOR 10 12, Alfaro",
    portalNumber: 10,
    extension: "12",
    postalCode: "26540",
    poblacion: "Alfaro",
    muni: "Alfaro",
    province: "La Rioja",
    provinceCode: "26",
    refCatastral: "3304123XM0730C",
    lat: 42.17,
    lng: -1.75,
  })!;
  expect(portal).toMatchObject({ kind: "portal", street: "Calle Mayor", number: "10", municipality: "Alfaro", postalCode: "26540" });
  expect(portal.detail).toBe("26540 Alfaro (La Rioja)");

  const street = normaliseCandidate({
    id: "y",
    type: "callejero",
    address: "CALLE GRAN VIA, Madrid",
    postalCode: "28008 28013 28014",
    poblacion: "Madrid",
    muni: "Madrid",
    provinceCode: "28",
  })!;
  expect(street).toMatchObject({ kind: "street", street: "Calle Gran Via", number: "", postalCode: "" });

  const village = normaliseCandidate({
    id: "z",
    type: "portal",
    address: "CALLE AGUILA REAL 3, Lagar de las Pitas (Alhaurín de la Torre)",
    portalNumber: 3,
    poblacion: "Lagar de las Pitas (Alhaurín de la Torre)",
    muni: "Alhaurín de la Torre",
    provinceCode: "29",
    postalCode: "29130",
  })!;
  expect(village.locality).toBe("Lagar de las Pitas");
  expect(normaliseCandidate({ id: "m", type: "Municipio", address: "Madrid", muni: "Madrid", provinceCode: "28" })).toBeNull();
});

test("OpenStreetMap fallback results map to the same shape", () => {
  const house = normalisePhoton({
    properties: {
      osm_type: "N",
      osm_id: 1,
      osm_key: "place",
      type: "house",
      housenumber: "12",
      street: "Calle Mayor",
      city: "Madrid",
      state: "Comunidad de Madrid",
      postcode: "28013",
      countrycode: "ES",
    },
    geometry: { coordinates: [-3.706, 40.416] },
  })!;
  expect(house).toMatchObject({ kind: "portal", street: "Calle Mayor", number: "12", provinceCode: "28", lat: 40.416 });
  expect(normalisePhoton({ properties: { type: "house", housenumber: "1", street: "High St", city: "Ealing", countrycode: "GB" } })).toBeNull();
  expect(guessProvinceCode(undefined, "Málaga", "Andalucía")).toBe("29");
  expect(guessProvinceCode(undefined, undefined, "Región de Murcia")).toBe("30");
  expect(guessProvinceCode("08008")).toBe("08");
  expect(guessProvinceCode(undefined, undefined, "Andalucía")).toBe("");
});

test("formats and validates Spanish addresses; postcode optional", () => {
  expect(formatSpanishAddress(spanishAddressSchema.parse(madrid))).toBe("Calle Mayor 12, 3º B, 28013 Madrid, España");
  const noCp = spanishAddressSchema.parse({ ...madrid, municipality: "Alhaurín el Grande", provinceCode: "29", postalCode: null, unit: null });
  expect(formatSpanishAddress(noCp)).toBe("Calle Mayor 12, Alhaurín el Grande (Málaga), España");
  expect(spanishAddressToProperty(noCp)).toEqual({
    addressLine1: "Calle Mayor 12",
    addressLine2: null,
    city: "Alhaurín el Grande (Málaga), España",
    postcode: "—",
  });
  expect(spanishAddressSchema.safeParse({ ...madrid, postalCode: "08008" }).success).toBe(false);
  expect(spanishAddressSchema.safeParse({ ...madrid, postalCode: "2801" }).success).toBe(false);
  expect(spanishAddressSchema.safeParse({ ...madrid, provinceCode: "99" }).success).toBe(false);
});

const booking = {
  requestedDate: "2030-01-15",
  requestedTime: "10:00",
  contactName: "Spain Test",
  contactEmail: TEST_EMAIL,
  contactPhone: "+34 600 000 000",
  furnishing: "Unfurnished",
  inspectionType: "Check-In Inventory",
  acceptTerms: true as const,
  acceptPrivacy: true as const,
  termsVersion: BOOKING_TERMS_VERSION,
  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
  locale: "es" as const,
};

test("Spanish booking is stored structured, with the address composed by the server", async () => {
  const { id } = await client.bookings.request({
    ...booking,
    propertyCountry: "ES",
    propertyAddress: "ignored",
    propertyAddressEs: { ...madrid, postalCode: "" },
  });
  const [row] = await db.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.id, id));
  expect(row.propertyCountry).toBe("ES");
  expect(row.propertyAddress).toBe("Calle Mayor 12, 3º B, Madrid, España");
  expect(row.propertyAddressEs?.catastralRef).toBe("0144605VK4704C");
  expect(row.propertyAddressEs?.postalCode).toBeNull();
});

test("Spanish booking needs the structured address and a matching postcode", async () => {
  const fail = async (input: unknown) => {
    try {
      await client.bookings.request(input as Parameters<typeof client.bookings.request>[0]);
    } catch (err) {
      return (err as { code?: string }).code;
    }
    return "accepted";
  };
  expect(await fail({ ...booking, propertyCountry: "ES", propertyAddress: "Calle Mayor 12, Madrid" })).toBe("BAD_REQUEST");
  expect(await fail({ ...booking, propertyCountry: "ES", propertyAddressEs: { ...madrid, postalCode: "08008" } })).toBe(
    "BAD_REQUEST",
  );
  expect(await fail({ ...booking, propertyCountry: "GB", propertyAddress: "" })).toBe("BAD_REQUEST");
});

test("address search finds a Spanish building by street, number and town", async () => {
  const { results, available } = await client.addresses.searchEs({ q: "calle mayor 12 madrid" });
  expect(available).toBe(true);
  const hit = results.find((r) => r.kind === "portal" && r.municipality === "Madrid");
  expect(hit).toMatchObject({ street: "Calle Mayor", number: "12", provinceCode: "28" });
});
