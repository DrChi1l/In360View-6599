# In360View Mobile — Build Plan (v1)

Native iOS + Android app for inspectors, built on the existing Expo package. Full offline
inspections, real camera capture, on-site signatures, store-ready.

## 1. What already exists (no rebuild needed)

The API is ~90% of the way there. Every procedure the phone needs is live:

| Need | Existing procedure |
|---|---|
| Today's jobs | `bookings.list`, `bookings.get` |
| Properties + search | `properties.list/get`, `search.global` |
| Start report | `reports.create`, `reports.baseCandidates` (check-out vs check-in) |
| Rooms / items | `inspection.addRoom/updateRoom/reorderRooms/addItem/updateItem/saveRoomBatch` |
| Photos | `photos.presign` → `photos.register` (has `clientId` for idempotent replay) |
| Meters / keys | on `reports.update` + inspection routes |
| Signatures | `signatures.create/finalise` |
| Complete + PDF | `reports.complete`, `documents.generate/url/email` |
| Auth | Better Auth already has the `expo()` plugin registered |

`inspection.saveRoomBatch` is the key one — a whole room in a single call, which is exactly the
right granularity for a sync queue. **No new tables, no schema migration.**

## 2. Offline architecture

The part that makes this a real field tool rather than a wrapper.

**Local store:** `expo-sqlite` mirrors the report shape on-device (reports, rooms, items, meters,
keys, photos). The phone reads and writes local SQLite only — the UI never waits on a network call,
so it behaves identically in a basement with no bars.

**Outbox:** every change appends an intent row (`entity`, `op`, `payload`, `clientId`,
`attempts`). A sync worker drains it in order whenever connectivity returns
(`expo-network` + app-foreground trigger). Idempotent by `clientId`, so a retry after a dropped
response can't duplicate. Failed rows surface in a "3 items waiting" chip, never silently drop.

**Photos:** captured to device storage at full resolution, downscaled locally, queued as file
paths. Upload = `photos.presign` → PUT → `photos.register`. Photos are the heavy part, so they
sync after the report structure and only on unmetered connections by default (toggleable).

**Conflicts:** an inspection belongs to one clerk in one visit, so last-write-wins per field is
correct and I won't build merge UI. A report locked server-side (`lockedAt`) rejects the push and
the app tells the clerk instead of overwriting signed evidence.

## 3. Screens

```
app/
  sign-in.tsx                  Google / Apple / email — Apple sign-in is required by
                               App Store rules once Google is offered
  (tabs)/
    index.tsx                  Today — jobs for today, sync status, resume draft
    properties.tsx             Property list + search
    reports.tsx                Reports: drafts, completed, awaiting signature
    account.tsx                Profile, sync settings, sign out
  property/[id].tsx            Property detail, history, start a report
  report/[id]/index.tsx        Inspection hub: room progress, meters, keys, complete
  report/[id]/room/[roomId].tsx  Room walkthrough — condition, cleanliness, notes, items, photos
  report/[id]/meters.tsx       Meter readings (+ photo of each meter)
  report/[id]/keys.tsx         Key sets
  report/[id]/sign.tsx         Signature capture — clerk + tenant
  report/[id]/complete.tsx     Review, complete, generate + share PDF
  capture.tsx                  Full-screen camera: rapid multi-shot, tagged to room/item
```

**Landlord/agent mode:** same app, read-only. They land on a reports list and can open the PDF.
One open question below.

## 4. Field-use design decisions

Poppins + the indigo palette from `design.md`, but the walkthrough screens are built for a phone
in one hand in bad light:

- Condition and cleanliness are **single-tap chip rows** (Excellent → Poor), never dropdowns
- 48px minimum touch targets; the primary action is always thumb-reachable at the bottom
- Camera is one tap from any room, returns straight to the room
- Notes accept voice dictation via the native keyboard
- Every screen shows the sync state so a clerk is never unsure whether work is safe
- Dark mode honoured — inspections happen in dim properties

## 5. New dependencies

`expo-sqlite`, `expo-file-system`, `expo-camera`, `expo-image-manipulator`, `expo-network`,
`expo-secure-store`, `expo-sharing`, `expo-font`, `@expo-google-fonts/poppins`,
`react-native-svg`, `react-native-view-shot` (signature → PNG), `better-auth@1.6.19`,
`@runablehq/managed-auth`, `expo-web-browser`, `expo-crypto`.

All installed with `expo install` in one pass before Metro starts. Native-only modules get
`Platform.OS` guards so the Runable web preview keeps working.

## 6. Store submission

App icon and adaptive icon from `logo-mark.png`, `app.json` given the real name, slug and bundle
ids, `eas.json` build profiles. Then the publish flow in the mobile preview dashboard (connect
your Expo account) runs EAS Build and Submit.

You have neither developer account yet, so in parallel you'll need:

| Item | Cost / note |
|---|---|
| Apple Developer Program | $99/year — enrolment can take a few days, start it early |
| Google Play Console | $25 one-time |
| Privacy policy URL | Mandatory both stores. You handle tenant names, addresses and property photos, so this needs real UK GDPR content — I can draft it and host it on the site |
| Store listing | Name, description, keywords, support URL, screenshots per device size — I can generate these from the finished app |
| Data safety / privacy labels | Declare camera, photos, account data |

Play also requires a closed test with testers before production for new personal accounts.

## 7. Build order

1. Auth + theming + fonts, tab shell, sign-in working against the live API
2. Offline engine: SQLite mirror, outbox, sync worker, sync-status UI
3. Today / properties / reports lists + property detail
4. The inspection core: report hub, room walkthrough, items
5. Camera capture + photo queue
6. Meters, keys
7. Signatures, complete, PDF generate + share
8. Icons, `app.json`, `eas.json`, privacy policy, store assets

Delivered and previewable at each stage, not just at the end.

## 8. One thing I need you to decide

**Landlord/agent access.** The web app scopes all data by `userId` — a landlord has no account
today, they receive reports by email. Two options:

- **A — Read-only for now (my default):** landlords/agents open reports through the existing
  emailed link. No new backend work, ships fastest.
- **B — Real landlord accounts:** a sharing model so a landlord signs in and sees every report for
  their properties. Needs a new `property_access` table, invite flow, and role checks across
  existing procedures. Maybe a week of extra work.

I'll assume **A** unless you say otherwise, and B becomes v1.1.
