CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"detail" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_access_links" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp (3) NOT NULL,
	"created_at" timestamp (3) NOT NULL,
	CONSTRAINT "booking_access_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "booking_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"requested_date" text NOT NULL,
	"requested_time" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"property_address" text NOT NULL,
	"property_country" text,
	"property_address_es" jsonb,
	"bedrooms" integer,
	"bathrooms" integer,
	"reception_rooms" integer,
	"furnishing" text,
	"inspection_type" text,
	"tenant_name" text,
	"tenant_email" text,
	"tenant_phone" text,
	"access_notes" text,
	"internal_notes" text,
	"confirmed_date" text,
	"confirmed_time" text,
	"confirmation_sent_at" timestamp (3),
	"terms_version" text,
	"privacy_notice_version" text,
	"terms_accepted_at" timestamp (3),
	"locale" text,
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"report_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"condition" text,
	"cleanliness" text,
	"description" text,
	"notes" text,
	"change_status" text,
	"previous_item_id" text,
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"meter_type" text NOT NULL,
	"serial_number" text,
	"reading" text,
	"location" text,
	"notes" text,
	"created_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"report_id" text,
	"room_id" text,
	"item_id" text,
	"storage_key" text NOT NULL,
	"thumb_key" text,
	"content_type" text DEFAULT 'image/jpeg' NOT NULL,
	"width" integer,
	"height" integer,
	"size" integer,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"client_id" text,
	"created_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reference" text,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text,
	"postcode" text NOT NULL,
	"property_type" text,
	"furnishing" text,
	"bedrooms" integer DEFAULT 0 NOT NULL,
	"bathrooms" integer DEFAULT 0 NOT NULL,
	"other_rooms" integer DEFAULT 0 NOT NULL,
	"landlord_name" text,
	"landlord_email" text,
	"tenant_name" text,
	"tenant_email" text,
	"notes" text,
	"front_photo_key" text,
	"front_photo_thumb_key" text,
	"front_photo_width" integer,
	"front_photo_height" integer,
	"front_photo_updated_at" timestamp (3),
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reference" text,
	"base_report_id" text,
	"inspection_date" timestamp (3) NOT NULL,
	"clerk_name" text,
	"clerk_email" text,
	"tenant_present" boolean DEFAULT false NOT NULL,
	"weather" text,
	"general_condition" text,
	"general_cleanliness" text,
	"maintenance_issues" text,
	"tenant_observations" text,
	"summary_notes" text,
	"pdf_key" text,
	"pdf_generated_at" timestamp (3),
	"completed_at" timestamp (3),
	"locked_at" timestamp (3),
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"name" text NOT NULL,
	"room_type" text DEFAULT 'custom' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"condition" text,
	"cleanliness" text,
	"notes" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"scheduled_for" timestamp (3) NOT NULL,
	"notes" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"report_id" text,
	"created_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"signer_role" text NOT NULL,
	"signer_name" text NOT NULL,
	"signer_email" text,
	"storage_key" text NOT NULL,
	"statement" text,
	"ip_address" text,
	"signed_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" text DEFAULT 'trial' NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"payment_status" text DEFAULT 'none' NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"price_amount" real,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"trial_ends_at" timestamp (3),
	"current_period_start" timestamp (3),
	"current_period_end" timestamp (3),
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"share_id" text NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"source_report_id" text,
	"snapshot" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"response" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"declaration" text,
	"created_at" timestamp (3) NOT NULL,
	"submitted_at" timestamp (3),
	CONSTRAINT "tenant_reports_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp (3),
	"refresh_token_expires_at" timestamp (3),
	"scope" text,
	"password" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp (3) NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"role" text DEFAULT 'clerk',
	"company_name" text,
	"phone" text,
	"disabled" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp (3) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_assets" ADD CONSTRAINT "tenant_assets_share_id_tenant_reports_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."tenant_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "booking_access_email_idx" ON "booking_access_links" USING btree ("email");--> statement-breakpoint
CREATE INDEX "booking_access_expiry_idx" ON "booking_access_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "booking_status_idx" ON "booking_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_date_idx" ON "booking_requests" USING btree ("requested_date");--> statement-breakpoint
CREATE INDEX "booking_updated_idx" ON "booking_requests" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "items_room_idx" ON "items" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "items_report_idx" ON "items" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "keys_report_idx" ON "key_sets" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "meters_report_idx" ON "meter_readings" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "photos_report_idx" ON "photos" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "photos_room_idx" ON "photos" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "photos_item_idx" ON "photos" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "photos_property_idx" ON "photos" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "properties_user_idx" ON "properties" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "properties_postcode_idx" ON "properties" USING btree ("postcode");--> statement-breakpoint
CREATE INDEX "reports_property_idx" ON "reports" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "reports_user_idx" ON "reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rooms_report_idx" ON "rooms" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "scheduled_user_idx" ON "scheduled_inspections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scheduled_date_idx" ON "scheduled_inspections" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "signatures_report_idx" ON "signatures" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_assets_share_idx" ON "tenant_assets" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");