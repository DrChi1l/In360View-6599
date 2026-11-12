import { boolean, index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import type { SpanishAddress } from "../lib/spain-address";

export * from "./auth-schema";

const now = () => new Date();

/** Properties managed by a clerk / agency / landlord account. */
export const properties = pgTable(
  "properties",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    reference: text("reference"),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city"),
    postcode: text("postcode").notNull(),
    propertyType: text("property_type"),
    furnishing: text("furnishing"),
    bedrooms: integer("bedrooms").default(0).notNull(),
    bathrooms: integer("bathrooms").default(0).notNull(),
    otherRooms: integer("other_rooms").default(0).notNull(),
    landlordName: text("landlord_name"),
    landlordEmail: text("landlord_email"),
    tenantName: text("tenant_name"),
    tenantEmail: text("tenant_email"),
    notes: text("notes"),
    /**
     * Front elevation of the property, uploaded against the property itself
     * rather than any one inspection. Used as the cover photograph on every
     * report view and PDF for this property.
     */
    frontPhotoKey: text("front_photo_key"),
    frontPhotoThumbKey: text("front_photo_thumb_key"),
    frontPhotoWidth: integer("front_photo_width"),
    frontPhotoHeight: integer("front_photo_height"),
    frontPhotoUpdatedAt: timestamp("front_photo_updated_at", { mode: "date", precision: 3 }),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("properties_user_idx").on(t.userId), index("properties_postcode_idx").on(t.postcode)],
);

/** An inspection report: check-in, check-out or mid-term. */
export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    userId: text("user_id").notNull(),
    /** check_in | check_out | mid_term */
    type: text("type").notNull(),
    /** draft | completed | signed */
    status: text("status").default("draft").notNull(),
    reference: text("reference"),
    /** For a check-out: the check-in report it is compared against. */
    baseReportId: text("base_report_id"),
    inspectionDate: timestamp("inspection_date", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
    clerkName: text("clerk_name"),
    clerkEmail: text("clerk_email"),
    tenantPresent: boolean("tenant_present").default(false).notNull(),
    weather: text("weather"),
    generalCondition: text("general_condition"),
    generalCleanliness: text("general_cleanliness"),
    maintenanceIssues: text("maintenance_issues"),
    tenantObservations: text("tenant_observations"),
    summaryNotes: text("summary_notes"),
    pdfKey: text("pdf_key"),
    pdfGeneratedAt: timestamp("pdf_generated_at", { mode: "date", precision: 3 }),
    completedAt: timestamp("completed_at", { mode: "date", precision: 3 }),
    lockedAt: timestamp("locked_at", { mode: "date", precision: 3 }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [
    index("reports_property_idx").on(t.propertyId),
    index("reports_user_idx").on(t.userId),
    index("reports_status_idx").on(t.status),
  ],
);

/** Rooms/areas within a report. */
export const rooms = pgTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id").notNull(),
    name: text("name").notNull(),
    /** Template key, e.g. kitchen, bedroom, bathroom, custom */
    roomType: text("room_type").default("custom").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    condition: text("condition"),
    cleanliness: text("cleanliness"),
    notes: text("notes"),
    /** Clerk has finished this room (drives inspection progress). */
    completed: boolean("completed").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("rooms_report_idx").on(t.reportId)],
);

/** Items/areas inspected within a room. */
export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    reportId: text("report_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    quantity: integer("quantity").default(1).notNull(),
    condition: text("condition"),
    cleanliness: text("cleanliness"),
    description: text("description"),
    notes: text("notes"),
    /** Check-out only: unchanged | changed | damaged | missing | cleaning_required */
    changeStatus: text("change_status"),
    /** Check-out only: the check-in item this row was copied from. */
    previousItemId: text("previous_item_id"),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("items_room_idx").on(t.roomId), index("items_report_idx").on(t.reportId)],
);

/** Photos — always linked to property + report, and optionally room + item. */
export const photos = pgTable(
  "photos",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    reportId: text("report_id"),
    roomId: text("room_id"),
    itemId: text("item_id"),
    /** S3 keys: full-size (compressed) and thumbnail. */
    storageKey: text("storage_key").notNull(),
    thumbKey: text("thumb_key"),
    contentType: text("content_type").default("image/jpeg").notNull(),
    width: integer("width"),
    height: integer("height"),
    size: integer("size"),
    caption: text("caption"),
    sortOrder: integer("sort_order").default(0).notNull(),
    /** Client-generated id so offline queues stay idempotent. */
    clientId: text("client_id"),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [
    index("photos_report_idx").on(t.reportId),
    index("photos_room_idx").on(t.roomId),
    index("photos_item_idx").on(t.itemId),
    index("photos_property_idx").on(t.propertyId),
  ],
);

/** Meter readings recorded at check-in / check-out. */
export const meterReadings = pgTable(
  "meter_readings",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id").notNull(),
    /** electricity | electricity_night | gas | water | oil | other */
    meterType: text("meter_type").notNull(),
    serialNumber: text("serial_number"),
    reading: text("reading"),
    location: text("location"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("meters_report_idx").on(t.reportId)],
);

/** Keys handed over / returned. */
export const keySets = pgTable(
  "key_sets",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("keys_report_idx").on(t.reportId)],
);

/** Digital signatures against a completed report. */
export const signatures = pgTable(
  "signatures",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id").notNull(),
    /** clerk | tenant | landlord | agent */
    signerRole: text("signer_role").notNull(),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email"),
    /** S3 key of the signature PNG. */
    storageKey: text("storage_key").notNull(),
    statement: text("statement"),
    ipAddress: text("ip_address"),
    signedAt: timestamp("signed_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("signatures_report_idx").on(t.reportId)],
);

/** Scheduled/upcoming inspections shown on the dashboard. */
export const scheduledInspections = pgTable(
  "scheduled_inspections",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    scheduledFor: timestamp("scheduled_for", { mode: "date", precision: 3 }).notNull(),
    notes: text("notes"),
    /** scheduled | completed | cancelled */
    status: text("status").default("scheduled").notNull(),
    reportId: text("report_id"),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("scheduled_user_idx").on(t.userId), index("scheduled_date_idx").on(t.scheduledFor)],
);

/** Subscription state — Stripe-ready, no pricing hard-coded. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    /** trial | monthly | annual */
    plan: text("plan").default("trial").notNull(),
    /** trialing | active | past_due | cancelled | expired */
    status: text("status").default("trialing").notNull(),
    /** unpaid | paid | failed | none */
    paymentStatus: text("payment_status").default("none").notNull(),
    seats: integer("seats").default(1).notNull(),
    priceAmount: real("price_amount"),
    currency: text("currency").default("GBP").notNull(),
    trialEndsAt: timestamp("trial_ends_at", { mode: "date", precision: 3 }),
    currentPeriodStart: timestamp("current_period_start", { mode: "date", precision: 3 }),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date", precision: 3 }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)],
);

/** Audit trail — who did what, needed for locked/signed reports. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).defaultNow().notNull(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId)],
);

/**
 * Public booking requests submitted from the landing page — a landlord or agent
 * asking for an inventory/inspection visit. No account required to submit.
 */
export const bookingRequests = pgTable(
  "booking_requests",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull(),
    /** new | confirmed | declined | done */
    status: text("status").default("new").notNull(),
    /** Requested slot, as picked on the landing page. */
    requestedDate: text("requested_date").notNull(),
    requestedTime: text("requested_time").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),
    propertyAddress: text("property_address").notNull(),
    /** GB | ES — null on older bookings means GB. */
    propertyCountry: text("property_country"),
    /** Structured Spanish address (JSON, see lib/spain-address.ts) — Spain is searched by street, not postcode. */
    propertyAddressEs: jsonb("property_address_es").$type<SpanishAddress>(),
    /** Size, as given by the requester. 0 bedrooms = studio; the top option ("6+", "5+", "4+") is stored as that number. */
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    receptionRooms: integer("reception_rooms"),
    furnishing: text("furnishing"),
    inspectionType: text("inspection_type"),
    tenantName: text("tenant_name"),
    tenantEmail: text("tenant_email"),
    tenantPhone: text("tenant_phone"),
    accessNotes: text("access_notes"),
    internalNotes: text("internal_notes"),
    /** The slot the office actually booked in — usually the requested one. */
    confirmedDate: text("confirmed_date"),
    confirmedTime: text("confirmed_time"),
    /** When the requester was last emailed that the visit is booked in. */
    confirmationSentAt: timestamp("confirmation_sent_at", { mode: "date", precision: 3 }),
    /** Versions of the booking terms and privacy/retention notice the requester agreed to. */
    termsVersion: text("terms_version"),
    privacyNoticeVersion: text("privacy_notice_version"),
    termsAcceptedAt: timestamp("terms_accepted_at", { mode: "date", precision: 3 }),
    /** Language the booking form and terms were shown in: en | es. The English terms govern. */
    locale: text("locale"),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [
    index("booking_status_idx").on(t.status),
    index("booking_date_idx").on(t.requestedDate),
    index("booking_updated_idx").on(t.updatedAt),
  ],
);

/** Immutable public report snapshots. Only a SHA-256 digest of the bearer token is stored. */
export const tenantReports = pgTable("tenant_reports", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  sourceReportId: text("source_report_id"),
  snapshot: text("snapshot").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  response: text("response").notNull(),
  revision: integer("revision").notNull().default(0),
  declaration: text("declaration"),
  createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  submittedAt: timestamp("submitted_at", { mode: "date", precision: 3 }),
});

/** Reservations and verified tenant assets, scoped to exactly one share. */
export const tenantAssets = pgTable(
  "tenant_assets",
  {
    id: text("id").primaryKey(),
    shareId: text("share_id").notNull().references(() => tenantReports.id),
    kind: text("kind").notNull(),
    contentType: text("content_type").notNull(),
    storageKey: text("storage_key").notNull(),
    ready: boolean("ready").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("tenant_assets_share_idx").on(t.shareId)],
);

/** Persistent hourly limits, shared across API workers/restarts. No raw IP addresses stored. */
export const tenantRateLimits = pgTable("tenant_rate_limits", {
  key: text("key").primaryKey(),
  hits: integer("hits").notNull().default(1),
  expiresAt: timestamp("expires_at", { mode: "date", precision: 3 }).notNull(),
});

/**
 * Private "My bookings" links emailed to the person who booked. Anyone holding
 * the link sees the bookings made with that email address, so only a SHA-256
 * digest of the token is stored and every link expires.
 */
export const bookingAccessLinks = pgTable(
  "booking_access_links",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 }).$defaultFn(now).notNull(),
  },
  (t) => [index("booking_access_email_idx").on(t.email), index("booking_access_expiry_idx").on(t.expiresAt)],
);
