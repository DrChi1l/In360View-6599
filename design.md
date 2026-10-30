# In360View — Design System

**Brand:** In360View — *Inventories · Inspections · Floorplans*
**Product:** UK property inventory & inspection platform (mobile-first, field-use).
**Feel:** professional, trustworthy, fast, dense-but-calm. Field-tool, not consumer app.
Explicitly NOT: bright childish colours, purple-gradient-on-white AI look, excessive animation, generic dashboard template.

## 1. Colour

Sampled from the supplied logo. Primary is the logo's deep indigo.

| Token | Value | Use |
|---|---|---|
| `--brand-900` | `#0B0333` | Darkest indigo — app chrome on mobile headers, PDF header band |
| `--brand-800` | `#12065C` | **Primary brand indigo** (logo colour) — primary buttons, active nav, headings |
| `--brand-700` | `#1D0F7A` | Hover/pressed primary |
| `--brand-600` | `#3career` (n/a) | — |
| `--brand-500` | `#4B36C4` | Focus rings, links, selected chips |
| `--brand-100` | `#EAE7F8` | Selected row tint, chip background |
| `--brand-50`  | `#F5F4FC` | Page background tint, sidebar background |

Neutrals (cool grey, never pure black text):

`--ink-900 #14121F` · `--ink-700 #3A3748` · `--ink-500 #6B6880` · `--ink-300 #A8A5B8` · `--ink-200 #D9D7E2` · `--ink-100 #EDECF2` · `--surface #FFFFFF` · `--canvas #F7F7FB`

Semantic / status (used **only** for condition, cleanliness and sync state — never decoration):

| Token | Value | Meaning |
|---|---|---|
| `--ok` | `#0E7C5A` | Excellent / Clean / Synced |
| `--ok-soft` | `#E4F4EE` | badge bg |
| `--good` | `#1F7AE0` | Good / Generally clean |
| `--good-soft` | `#E7F1FD` | badge bg |
| `--warn` | `#B8730B` | Fair |
| `--warn-soft` | `#FDF2E0` | badge bg |
| `--bad` | `#C2410C` | Poor / Very poor |
| `--bad-soft` | `#FDEBE2` | badge bg |
| `--danger` | `#B4173C` | Damaged / destructive actions (logo pink family) |
| `--danger-soft` | `#FBE7EC` | badge bg |
| `--na` | `--ink-500` | Not applicable |

Logo accent colours (cyan `#00A9CE`, amber `#F8B84E`, pink `#D81E5B`) appear **only inside the logo mark**. Do not use them as UI accents.

Marketing button and text accent: **#2F2962**, replacing the previous yellow across gold-400/500/600. Use white labels on these dark buttons for readable contrast. Keep the logo artwork and inspection status colours unchanged.

Hero headline: a crisp 1px off-white outline painted behind the purple “you can rely on” lettering, plus a restrained 2px shadow. No shadow on the white heading text and no broad glow; retain the #2F2962 fill.

Hero booking CTA: inverted white surface with bold #2F2962 text and arrow, a soft shadow, and a pale-indigo hover state so it stands out against the photograph. Other buttons remain unchanged.

Mobile public navigation: show Price list and PDF links explicitly below the logo; never hide access to pricing behind desktop-only navigation. The prices page has separate Open PDF and Download PDF actions above the artwork for phone browsers.

## 2. Logo usage

Assets in `packages/web/public/images/` (mirrored in `packages/mobile/assets/`):

- `logo-full.png` — wordmark + tagline, for light backgrounds (auth screens, PDF cover)
- `logo-wordmark.png` — wordmark only, light backgrounds
- `logo-mark.png` — the 360° orbit mark alone, transparent; used as the app icon and as the inline glyph in the composed lockup

For dark surfaces use the **composed lockup** (`<Logo />` component): text `In` + mark image + `View` set in Poppins ExtraBold, `tracking-tight`, so the wordmark can be rendered white on indigo at any size. Minimum lockup height 20px; never stretch, recolour the mark, or add effects. Clear space = height of the "I".

## 3. Typography

**Poppins** (matches the logo's geometric sans) for everything — loaded via Google Fonts on web, `@expo-google-fonts/poppins` on mobile.

| Role | Spec |
|---|---|
| Display / page title | Poppins 600, 24–32px, `tracking-tight`, ink-900 |
| Section heading | Poppins 600, 16–18px |
| Card/row title | Poppins 500, 15px |
| Body | Poppins 400, 14–15px, line-height 1.55, ink-700 |
| Label / meta | Poppins 500, 11–12px, `uppercase tracking-[0.08em]`, ink-500 |
| Numeric stat | Poppins 600, 28–34px, `tabular-nums` |

Never use Inter, Roboto or Space Grotesk. Sentence case for UI copy. UK English throughout (colour, organise, metre).

## 4. Layout

- **Mobile (priority):** single column, 16px gutters, sticky top bar (56px) with back + title + one action, persistent bottom tab bar (Home · Properties · New · Reports · Profile) with a raised centre "New" action. Inside an inspection the bottom bar is replaced by a **sticky action bar** (Prev room · Save · Next room) so the clerk never navigates back through menus.
- **Tablet/desktop web:** fixed 248px left sidebar (brand-50, indigo active pill), max-width 1200px content column, 24–32px gutters. Two-pane inspection view: room list left, room detail right.
- **Density:** field data is list-heavy — use flat rows with 1px `--ink-100` dividers rather than card grids. Cards only for dashboard stats and report summaries.
- Radius: 10px controls, 14px cards, 999px chips. Shadows: one soft level only (`0 1px 2px rgb(20 18 31 / .06), 0 8px 24px -12px rgb(20 18 31 / .18)`).
- Touch targets ≥ 44px. Primary actions bottom-anchored and thumb-reachable on mobile.

## 5. Components

- **Buttons:** primary = brand-800 fill, white text; secondary = white fill, ink-200 border; ghost = transparent; destructive = danger. Full-width on mobile forms.
- **Condition / cleanliness pickers:** horizontal segmented chip row, one tap to set, colour-coded by the semantic tokens, shows selected state with filled chip. This is the most-used control in the app — it must be one tap, always visible without scrolling on a phone.
- **Photo grid:** 3-up on mobile / 6-up on desktop, square thumbnails (320px variants), lazy-loaded (`loading="lazy"` / FlatList windowing), badge for upload state, tap = full-screen viewer with swipe.
- **Photo viewer:** one viewer for the whole app. Whichever thumbnail is tapped, it opens the report's complete photo sequence in report order — front elevation, then each room's own photos, then that room's item photos, room by room — so a right-to-left swipe walks the report the way the PDF reads. Caption editing and delete live in the viewer and appear only while the report is unlocked.
- **Corner photo:** the property's cover photograph sits in the top-right corner of the property header card as a quarter-circle (`rounded-bl-[999px]`) with a white ring and a soft brand-100 glow behind it. Same motif as the report cover and the PDF. Text in the card keeps right padding so nothing runs under it.
- **Swipe to delete:** room rows and item rows sit in a `SwipeRow`. Dragging right-to-left past 44px latches the row open and uncovers a 96px danger-red Delete action; the delete itself needs a deliberate tap, so a brushed list never loses data. A swipe never fires the row's own tap target, a tap on an open row just closes it, and the action button is reachable by Tab (focus opens the row, blur closes it). Locked reports get no gesture and no action at all.
- **Status pills:** Draft (ink), Completed (good), Signed (ok), Locked (brand).
- **Sync indicator:** persistent small pill in the top bar — "Synced" (ok), "Saving… n" (brand, spinner), "Offline · n queued" (warn), tap for detail.
- **Empty states:** one line of ink-500 copy + one primary action. No illustrations.

## 6. Motion

Restrained: 150ms ease-out for press/hover states, 200ms for sheet/drawer, staggered list reveal only on first dashboard load. No parallax, no looping animation, nothing that delays data entry.

Touch response is part of motion: every button and chip answers a press instantly (75ms transition on colour/shadow/transform only, never `transition-all`, plus `active:scale-[0.97]` with zero delay), and interactive elements set `touch-action: manipulation` so mobile browsers don't hold taps back waiting for a double-tap. A clerk on site must never wonder whether a tap registered.

## Tenant review

Public bearer-link page, without the staff sidebar or a sign-in prompt. Poppins, white surfaces, indigo section rules, calm single-column report reading, responsive photo grids and generous touch targets. Original entries are visually separate from pale-indigo tenant observation fields. A green confirmation and disabled controls clearly mark final submission. Draft save and final signature submission are separate actions. Tenant feedback never edits the original snapshot.

## 7. PDF report

A4 portrait. Indigo header band with white lockup on page 1, property address as H1, meta table (report type, date, clerk, landlord, tenant, reference). Room sections with a rule + room name in brand-800, item table (Item · Condition · Cleanliness · Description/Notes) with colour-coded condition text, photos in a 3-up grid directly beneath the room they belong to with captions. Footer on every page: `In360View · Inventories · Inspections · Reports` left, property reference centre, `Page n of m` right. Signature page with signature images, printed names and timestamps, plus a locked-document statement. Must read like a professional UK inventory, not a form dump.

## Booking flow & terms pop-up
- Booking form is never rendered on page load. It opens in a native `<dialog>` modal (full-screen on phones, centred card ≥sm) only from booking buttons on `/sign-in` (header, mobile nav, hero, footer) and `/prices` (header, bottom CTA). `?book` / `#book` deep links also open it.
- Pressing **Request booking** (after the form validates) opens a second modal: Key points / Terms / Privacy & retention tabs, two unticked checkboxes, and **Agree and send booking** disabled until both are ticked.
- Legal copy lives in `packages/web/src/api/lib/booking-terms.ts` (shared with the server and the public `/terms` page). Bump the version strings when wording changes; the server rejects stale versions and stores the agreed versions + time on each booking.
- Retention: unconfirmed/declined requests auto-deleted after 12 months; confirmed/done bookings auto-deleted 6 years after last update (`lib/booking-retention.ts`). Reports/properties are reviewed manually — not automated.

## Languages (English / Spanish)
- Public pages only: landing (`/sign-in`), `/prices`, `/terms`, booking dialog and terms pop-up. The staff app, tenant report (`/t/:token`), office emails and the logo tagline stay English.
- **EN / ES switcher** (`components/language-switch.tsx`) sits in each public header: pill with a translate icon, active option filled `brand-800` (white on the dark tone). Keep it visible on mobile — hide secondary nav links before hiding it.
- Language resolution (`lib/i18n.tsx`): `?lang=es|en` → saved choice (`localStorage` `in360view.lang`) → `/es`, `/es/prices`, `/es/terms` (redirect to the English path, language kept) → browser language → English. `<html lang>` and tab titles follow the language.
- Copy lives in an `{ en, es }` `COPY` object per page, read with `useCopy`. Dates use `Intl` with `localeFor(lang)`. Stored values (furnishing, inspection type) are always English; only labels are translated.
- Spanish legal text (`api/lib/booking-terms-es.ts`) is a courtesy translation with the same section ids and the same version strings; the English text governs and the notice says so. When the English terms change, update the Spanish file in the same change (the test checks the sections line up).
- Each booking stores `locale`; Spanish bookings are flagged `[ES]` in the office email subject and "shown in Spanish" in the staff Bookings screen.
- The price list image/PDF is English-only; the Spanish page says amounts are in £.

## Spanish property addresses
- Booking form asks **"Where is the property?" — United Kingdom / Spain** (segmented toggle). Defaults to Spain when the site is in Spanish, UK in English; either can be picked.
- UK: one free-text line including the postcode (unchanged).
- Spain: addresses are found by **street + number + municipality**, not postcode. A search box (`components/spanish-address.tsx`) queries `addresses.searchEs` → CartoCiudad (IGN, official, returns the building's catastral ref), falling back to Photon/OpenStreetMap if CartoCiudad is down. Picking a result fills Vía, Número, Municipio, Provincia and CP; "street only" results focus Número. All fields stay editable by hand.
- Fields: Vía *, Número * (or s/n), Bloque / escalera / piso / puerta, Municipio *, Provincia * (52, by INE code), Código postal (optional, 5 digits; must start with the province code).
- Stored as `propertyCountry = "ES"` + `propertyAddressEs` JSON; the server composes the one-line address ("Calle Mayor 12, 3º B, 28013 Madrid, España"). Staff Bookings shows a "Spain" tag, catastral ref and map link; converting to a property puts "Municipio (Provincia), España" in the town and "—" as the postcode when none was given.
