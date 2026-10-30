/**
 * Dev-only seeding helper: builds one fully populated demo report so the report
 * view and the generated PDF can be eyeballed. Run with:
 *   bun --env-file=../../.env seed-demo.ts
 */
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "./src/api/database";
import * as schema from "./src/api/database/schema";
import { newId } from "./src/api/lib/ids";
import { putObject } from "./src/api/lib/s3";

const EMAIL = "demo@in360view.test";


const users = await db.select().from((await import("./src/api/database/auth-schema")).user);
const owner = users.find((u) => u.email === EMAIL) ?? users[0];
if (!owner) throw new Error("No user exists yet — sign up in the app first.");
console.log("owner:", owner.email);

const propertyId = newId("prp");
await db.insert(schema.properties).values({
  id: propertyId,
  userId: owner.id,
  reference: "PR-104829",
  addressLine1: "42 Ashcombe Road",
  addressLine2: "Flat 2",
  city: "Bristol",
  postcode: "BS7 9QT",
  propertyType: "Victorian terrace",
  furnishing: "Part furnished",
  bedrooms: 2,
  bathrooms: 1,
  otherRooms: 2,
  landlordName: "Marcus Wainwright",
  landlordEmail: "m.wainwright@example.co.uk",
  tenantName: "Priya Desai",
  tenantEmail: "p.desai@example.com",
});

const reportId = newId("rep");
await db.insert(schema.reports).values({
  id: reportId,
  propertyId,
  userId: owner.id,
  type: "check_in",
  status: "signed",
  reference: "CI-204831",
  inspectionDate: new Date("2026-09-14T09:30:00Z"),
  clerkName: "Helen Carter",
  clerkEmail: "helen.carter@in360view.co.uk",
  tenantPresent: true,
  weather: "Dry, overcast, 17°C",
  generalCondition: "good",
  generalCleanliness: "clean",
  summaryNotes:
    "The property was presented in good decorative order throughout and professionally cleaned prior to the inspection. All rooms were accessible and the tenant attended for the full inspection.",
  maintenanceIssues:
    "Kitchen extractor fan is noisy in operation and should be serviced.\nHairline crack to the plaster above the living room window — monitor only.",
  tenantObservations:
    "Tenant noted a small chip to the bath enamel and asked that it be recorded at check-in.",
  completedAt: new Date("2026-09-14T13:10:00Z"),
  lockedAt: new Date("2026-09-14T13:42:00Z"),
});

const rooms = [
  {
    name: "Front elevation & entrance hall",
    roomType: "hallway",
    condition: "good",
    cleanliness: "clean",
    notes:
      "Painted timber front door with Yale and mortice locks. Hall laid with engineered oak, light scuffing consistent with normal use.",
    photos: [
      { file: "/home/user/Images/unsplash-uk-terraced-houses-residential-street-photo_3.jpg", caption: "Front elevation of the property from the street" },
      { file: "/home/user/Images/unsplash-uk-terraced-houses-residential-street-photo_5.jpg", caption: "Front door and entrance approach" },
    ],
    items: [
      { name: "Front door & furniture", condition: "good", cleanliness: "clean", description: "White painted timber door, chrome handle, working letterplate." },
      { name: "Hall flooring", condition: "good", cleanliness: "clean", description: "Engineered oak, light scuffing near the threshold." },
      { name: "Ceiling & light fitting", condition: "excellent", cleanliness: "clean", description: "Pendant fitting with shade, bulb working." },
    ],
  },
  {
    name: "Kitchen / diner",
    roomType: "kitchen",
    condition: "good",
    cleanliness: "clean",
    notes: "Fitted grey shaker units with laminate worktops. All appliances present and apparently operational on the day.",
    photos: [
      { file: "/home/user/Images/unsplash-empty-kitchen-interior-uk-rental-flat-photo_1.jpg", caption: "Kitchen looking towards the window" },
      { file: "/home/user/Images/unsplash-empty-kitchen-interior-uk-rental-flat-photo_9.jpg", caption: "Worktop and splashback" },
    ],
    items: [
      { name: "Base & wall units", quantity: 11, condition: "good", cleanliness: "clean", description: "Grey shaker doors, all hinges sound. Minor edge wear to the unit beside the oven." },
      { name: "Worktops", condition: "good", cleanliness: "clean", description: "Oak-effect laminate, one 30mm scorch mark to the right of the hob.", notes: "Recorded at check-in." },
      { name: "Oven & hob", condition: "good", cleanliness: "clean", description: "Four-ring gas hob, single electric oven. Interior clean." },
      { name: "Extractor fan", condition: "fair", cleanliness: "generally_clean", description: "Operational but noisy on all speeds.", notes: "Reported to the landlord." },
      { name: "Fridge freezer", condition: "good", cleanliness: "clean", description: "Freestanding, defrosted and clean." },
    ],
  },
  {
    name: "Living room",
    roomType: "living_room",
    condition: "good",
    cleanliness: "clean",
    notes: "Bay window to the front with working sash. Carpet professionally cleaned.",
    photos: [
      { file: "/home/user/Images/unsplash-empty-living-room-interior-rental-photo_0.jpg", caption: "Living room from the doorway" },
      { file: "/home/user/Images/unsplash-empty-living-room-interior-rental-photo_7.jpg", caption: "Bay window and decorative surround" },
    ],
    items: [
      { name: "Carpet", condition: "good", cleanliness: "clean", description: "Grey twist pile, no visible marks." },
      { name: "Walls & decoration", condition: "good", cleanliness: "clean", description: "Magnolia emulsion. Hairline crack above the window — monitor." },
      { name: "Two-seat sofa", condition: "good", cleanliness: "clean", description: "Grey fabric, fire label attached and intact." },
      { name: "Radiator", condition: "good", cleanliness: "clean", description: "Double panel, both valves turn freely." },
    ],
  },
  {
    name: "Bathroom",
    roomType: "bathroom",
    condition: "fair",
    cleanliness: "clean",
    notes: "White three-piece suite. Sealant renewed prior to the tenancy.",
    photos: [
      { file: "/home/user/Images/unsplash-bathroom-interior-clean-rental-photo_2.jpg", caption: "Bathroom suite" },
      { file: "/home/user/Images/unsplash-bathroom-interior-clean-rental-photo_5.jpg", caption: "Chip to the bath enamel, near the taps" },
    ],
    items: [
      { name: "Bath & shower over", condition: "fair", cleanliness: "clean", description: "10mm chip to the enamel beside the hot tap. Shower runs hot and cold.", notes: "Raised by the tenant at check-in." },
      { name: "WC", condition: "good", cleanliness: "clean", description: "Close-coupled, flushes correctly, seat secure." },
      { name: "Basin & pedestal", condition: "good", cleanliness: "clean", description: "No chips, both taps run freely." },
      { name: "Extractor & window", condition: "good", cleanliness: "clean", description: "Extractor operational, obscured window opens and locks." },
    ],
  },
];

let sort = 0;
for (const room of rooms) {
  const roomId = newId("rom");
  await db.insert(schema.rooms).values({
    id: roomId,
    reportId,
    name: room.name,
    roomType: room.roomType,
    sortOrder: sort++,
    condition: room.condition,
    cleanliness: room.cleanliness,
    notes: room.notes,
    completed: true,
  });

  let itemSort = 0;
  for (const item of room.items) {
    await db.insert(schema.items).values({
      id: newId("itm"),
      roomId,
      reportId,
      name: item.name,
      sortOrder: itemSort++,
      quantity: item.quantity ?? 1,
      condition: item.condition,
      cleanliness: item.cleanliness,
      description: item.description,
      notes: item.notes ?? null,
    });
  }

  let photoSort = 0;
  for (const photo of room.photos) {
    const bytes = new Uint8Array(await readFile(photo.file));
    const photoId = newId("pho");
    const key = `properties/${propertyId}/reports/${reportId}/${photoId}.jpg`;
    await putObject(key, bytes, "image/jpeg");
    await db.insert(schema.photos).values({
      id: photoId,
      propertyId,
      reportId,
      roomId,
      storageKey: key,
      thumbKey: key,
      contentType: "image/jpeg",
      caption: photo.caption,
      sortOrder: photoSort++,
      size: bytes.byteLength,
    });
  }
}

for (const meter of [
  { meterType: "electricity", serialNumber: "K14G 882301", reading: "41872.4", location: "Cupboard, entrance hall" },
  { meterType: "gas", serialNumber: "G4 7729114", reading: "09318", location: "External box, front elevation" },
  { meterType: "water", serialNumber: "W-5521884", reading: "00412", location: "Pavement stopcock" },
]) {
  await db.insert(schema.meterReadings).values({ id: newId("met"), reportId, ...meter });
}

for (const key of [
  { description: "Front door — Yale", quantity: 2, notes: "Issued to tenant" },
  { description: "Front door — mortice", quantity: 2, notes: "Issued to tenant" },
  { description: "Window key", quantity: 1, notes: "Left in kitchen drawer" },
  { description: "Communal bin store fob", quantity: 1, notes: null },
]) {
  await db.insert(schema.keySets).values({ id: newId("key"), reportId, ...key });
}

/* Two signatures, drawn as simple SVG-ish PNG placeholders. */
const signaturePng = (name: string) => {
  // Minimal 1-bit signature drawn with ImageMagick would be nicer; here we reuse
  // a generated stroke so the layout can be judged.
  return Bun.spawnSync([
    "convert",
    "-size",
    "520x160",
    "xc:white",
    "-stroke",
    "#12065C",
    "-strokewidth",
    "3",
    "-fill",
    "none",
    "-draw",
    "path 'M 40,110 C 90,20 130,150 180,80 S 250,20 300,100 380,140 460,60'",
    "-font",
    "DejaVu-Sans",
    "-pointsize",
    "18",
    "-stroke",
    "none",
    "-fill",
    "#5C5A6B",
    "-annotate",
    "+40+145",
    name,
    "png:-",
  ]).stdout;
};

for (const sig of [
  { signerRole: "clerk", signerName: "Helen Carter", signerEmail: "helen.carter@in360view.co.uk" },
  { signerRole: "tenant", signerName: "Priya Desai", signerEmail: "p.desai@example.com" },
]) {
  const id = newId("sig");
  const key = `properties/${propertyId}/reports/${reportId}/signatures/${id}.png`;
  await putObject(key, new Uint8Array(signaturePng(sig.signerName)), "image/png");
  await db.insert(schema.signatures).values({
    id,
    reportId,
    ...sig,
    storageKey: key,
    signedAt: new Date("2026-09-14T13:40:00Z"),
  });
}

const [check] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId));
console.log("seeded report:", check.id, check.reference);
console.log("view at: /reports/" + check.id + "/view");
