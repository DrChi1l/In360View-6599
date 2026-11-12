/**
 * Shared inspection vocabulary and room/item templates.
 * Imported by the API, the web frontend and the mobile app
 * (mobile via `@template/web`) so every client speaks the same language.
 */

export const REPORT_TYPES = ["check_in", "check_out", "mid_term"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  check_in: "Check-In",
  check_out: "Check-Out",
  mid_term: "Mid-Term Inspection",
};

export const REPORT_STATUSES = ["draft", "completed", "signed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CONDITIONS = ["excellent", "good", "fair", "poor", "damaged", "na"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  damaged: "Damaged",
  na: "N/A",
};

export const CLEANLINESS = ["clean", "generally_clean", "fair", "poor", "very_poor", "na"] as const;
export type Cleanliness = (typeof CLEANLINESS)[number];

export const CLEANLINESS_LABELS: Record<Cleanliness, string> = {
  clean: "Clean",
  generally_clean: "Generally clean",
  fair: "Fair",
  poor: "Poor",
  very_poor: "Very poor",
  na: "N/A",
};

export const CHANGE_STATUSES = ["unchanged", "changed", "damaged", "missing", "cleaning_required"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  unchanged: "No change",
  changed: "Changed",
  damaged: "Damage",
  missing: "Missing",
  cleaning_required: "Cleaning required",
};

export const PROPERTY_TYPES = [
  "Flat / Apartment",
  "Studio",
  "Terraced house",
  "End of terrace",
  "Semi-detached house",
  "Detached house",
  "Maisonette",
  "Bungalow",
  "HMO / Room let",
  "Commercial",
] as const;

export const FURNISHING_TYPES = ["Unfurnished", "Part furnished", "Fully furnished"] as const;

export const USER_ROLES = ["clerk", "agency", "landlord", "admin"] as const;

/** Roles a person may pick for themselves. Admin is granted only by the operator (ADMIN_EMAILS or SQL). */
export const SELF_ASSIGNABLE_ROLES = ["clerk", "agency", "landlord"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  clerk: "Inventory Clerk",
  agency: "Agency",
  landlord: "Landlord",
  admin: "Admin",
};

export const METER_TYPES = [
  { value: "electricity", label: "Electricity" },
  { value: "electricity_night", label: "Electricity (night)" },
  { value: "gas", label: "Gas" },
  { value: "water", label: "Water" },
  { value: "oil", label: "Oil" },
  { value: "other", label: "Other" },
] as const;

/** Standard fabric items present in nearly every room. */
const FABRIC = [
  "Walls",
  "Ceiling",
  "Floor / Floor covering",
  "Skirting",
  "Doors & frames",
  "Windows & sills",
  "Window coverings",
  "Lighting",
  "Electrical sockets & switches",
  "Heating / Radiators",
];

export type RoomTemplate = {
  type: string;
  name: string;
  items: string[];
};

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    type: "entrance",
    name: "Entrance / Hallway",
    items: [...FABRIC, "Front door & security", "Entry phone", "Smoke alarm", "Meter cupboard", "Storage"],
  },
  {
    type: "living_room",
    name: "Living Room",
    items: [...FABRIC, "Sofas & chairs", "Tables", "Shelving & storage", "Fireplace", "TV point", "Decorative items"],
  },
  {
    type: "kitchen",
    name: "Kitchen",
    items: [
      ...FABRIC,
      "Worktops",
      "Units & cupboards",
      "Sink & taps",
      "Splashback / Tiling",
      "Oven & hob",
      "Extractor",
      "Fridge / Freezer",
      "Washing machine",
      "Dishwasher",
      "Microwave",
      "Boiler",
      "Crockery & utensils",
    ],
  },
  {
    type: "dining_room",
    name: "Dining Room",
    items: [...FABRIC, "Dining table", "Dining chairs", "Sideboard / Storage"],
  },
  {
    type: "bedroom",
    name: "Bedroom",
    items: [...FABRIC, "Bed frame", "Mattress", "Wardrobe", "Chest of drawers", "Bedside tables", "Mirror"],
  },
  {
    type: "bathroom",
    name: "Bathroom",
    items: [
      ...FABRIC,
      "Bath",
      "Shower & screen",
      "Shower head & hose",
      "Basin & taps",
      "WC & cistern",
      "Tiling & grout",
      "Sealant",
      "Extractor fan",
      "Towel rail",
      "Mirror / Cabinet",
    ],
  },
  {
    type: "ensuite",
    name: "Ensuite",
    items: [...FABRIC, "Shower & screen", "Basin & taps", "WC & cistern", "Tiling & grout", "Sealant", "Extractor fan"],
  },
  {
    type: "wc",
    name: "Cloakroom / WC",
    items: [...FABRIC, "Basin & taps", "WC & cistern", "Extractor fan"],
  },
  {
    type: "utility",
    name: "Utility Room",
    items: [...FABRIC, "Worktops", "Units", "Sink & taps", "Washing machine", "Tumble dryer", "Boiler"],
  },
  {
    type: "stairs",
    name: "Stairs & Landing",
    items: [...FABRIC, "Bannister & spindles", "Stair covering", "Loft hatch", "Airing cupboard"],
  },
  {
    type: "garden",
    name: "Garden",
    items: [
      "Lawn",
      "Borders & planting",
      "Patio / Decking",
      "Fencing & gates",
      "Shed / Outbuilding",
      "Outside tap",
      "Bins",
      "Garden furniture",
    ],
  },
  {
    type: "garage",
    name: "Garage",
    items: ["Walls", "Ceiling", "Floor", "Garage door", "Lighting", "Electrical sockets", "Storage"],
  },
  {
    type: "parking",
    name: "Parking / Driveway",
    items: ["Surface", "Markings", "Gates / Barrier", "Lighting"],
  },
  {
    type: "exterior",
    name: "Exterior & Communal",
    items: [
      "Front elevation",
      "Rear elevation",
      "Roof (visible)",
      "Guttering & downpipes",
      "External doors",
      "External windows",
      "Communal areas",
    ],
  },
  { type: "custom", name: "Other room", items: [...FABRIC] },
];

export function templateFor(type: string): RoomTemplate | undefined {
  return ROOM_TEMPLATES.find((t) => t.type === type);
}

/** Room set proposed for a property, based on its bedroom/bathroom counts. */
export function suggestedRooms(input: { bedrooms: number; bathrooms: number; otherRooms?: number }) {
  const rooms: { type: string; name: string }[] = [
    { type: "entrance", name: "Entrance / Hallway" },
    { type: "living_room", name: "Living Room" },
    { type: "kitchen", name: "Kitchen" },
  ];
  for (let i = 1; i <= Math.max(0, input.bedrooms); i++) {
    rooms.push({ type: "bedroom", name: `Bedroom ${i}` });
  }
  for (let i = 1; i <= Math.max(0, input.bathrooms); i++) {
    rooms.push({ type: "bathroom", name: input.bathrooms > 1 ? `Bathroom ${i}` : "Bathroom" });
  }
  rooms.push({ type: "exterior", name: "Exterior & Communal" });
  return rooms;
}

/** Pre-written description used when the clerk sets a condition but types nothing. */
export function describeItem(name: string, condition?: string | null, cleanliness?: string | null) {
  const parts: string[] = [];
  if (condition && condition !== "na") {
    parts.push(`${CONDITION_LABELS[condition as Condition] ?? condition} condition`);
  }
  if (cleanliness && cleanliness !== "na") {
    parts.push((CLEANLINESS_LABELS[cleanliness as Cleanliness] ?? cleanliness).toLowerCase());
  }
  if (!parts.length) return "";
  return `${name} — ${parts.join(", ")}.`;
}
