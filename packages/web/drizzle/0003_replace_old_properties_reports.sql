-- Run once in the Supabase SQL editor. Safe to run again.
--
-- Why: your Supabase project already had OLD tables called `properties` and `reports` (from an
-- earlier project, with different columns and uuid user ids). The website's migration used a plain
-- CREATE TABLE, so for these two names it failed and the old tables stayed. The website then
-- crashed with: column "archived" does not exist / column "reference" does not exist /
-- invalid input syntax for type uuid.
--
-- What this does: renames each old table (and its indexes) to <name>_pre_website, so nothing is
-- deleted, then creates the two tables the website expects. Tables that already have the
-- website's columns are left alone.

do $$
declare
  t text;
  marker text;
  idx record;
begin
  foreach t in array array['properties', 'reports'] loop
    marker := case t when 'properties' then 'archived' else 'locked_at' end;
    if to_regclass(format('public.%I', t)) is not null
       and not exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = t and column_name = marker
       ) then
      for idx in select indexname from pg_indexes where schemaname = 'public' and tablename = t loop
        execute format('alter index public.%I rename to %I', idx.indexname, idx.indexname || '_pre_website');
      end loop;
      execute format('alter table public.%I rename to %I', t, t || '_pre_website');
      raise notice 'renamed old public.% to public.%_pre_website', t, t;
    end if;
  end loop;
end $$;

create table if not exists public.properties (
	"id" text primary key not null,
	"user_id" text not null,
	"reference" text,
	"address_line1" text not null,
	"address_line2" text,
	"city" text,
	"postcode" text not null,
	"property_type" text,
	"furnishing" text,
	"bedrooms" integer default 0 not null,
	"bathrooms" integer default 0 not null,
	"other_rooms" integer default 0 not null,
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
	"archived" boolean default false not null,
	"created_at" timestamp (3) not null,
	"updated_at" timestamp (3) not null
);

create table if not exists public.reports (
	"id" text primary key not null,
	"property_id" text not null,
	"user_id" text not null,
	"type" text not null,
	"status" text default 'draft' not null,
	"reference" text,
	"base_report_id" text,
	"inspection_date" timestamp (3) not null,
	"clerk_name" text,
	"clerk_email" text,
	"tenant_present" boolean default false not null,
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
	"created_at" timestamp (3) not null,
	"updated_at" timestamp (3) not null
);

create index if not exists properties_user_idx on public.properties using btree (user_id);
create index if not exists properties_postcode_idx on public.properties using btree (postcode);
create index if not exists reports_property_idx on public.reports using btree (property_id);
create index if not exists reports_user_idx on public.reports using btree (user_id);
create index if not exists reports_status_idx on public.reports using btree (status);

-- Keep Supabase's public API away from these tables (the website reads them directly).
do $$
declare t text;
begin
  foreach t in array array['properties', 'reports', 'properties_pre_website', 'reports_pre_website'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Check: both lists should now contain the website's columns.
select table_name, count(*) as columns,
       bool_or(column_name = 'archived') as has_archived,
       bool_or(column_name = 'locked_at') as has_locked_at,
       max(data_type) filter (where column_name = 'user_id') as user_id_type
from information_schema.columns
where table_schema = 'public' and table_name in ('properties', 'reports')
group by table_name order by table_name;
