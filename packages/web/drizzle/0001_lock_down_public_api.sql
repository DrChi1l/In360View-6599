-- Run once in the Supabase SQL editor.
--
-- The website talks to Postgres directly (DATABASE_URL, the `postgres` role), which is NOT
-- affected by row-level security. But Supabase also exposes every table in the `public`
-- schema through its public REST API, reachable with the publishable key that ships in
-- any app. With row-level security off that means anyone could read or change users,
-- password hashes, sessions, customer bookings and reports.
--
-- This turns row-level security on for every website table and removes the public API's
-- access. With no policies defined, the REST API sees nothing; the website is unaffected.
do $$
declare t text;
begin
  foreach t in array array[
    'user', 'session', 'account', 'verification',
    'properties', 'reports', 'rooms', 'items', 'photos', 'meter_readings', 'key_sets',
    'signatures', 'scheduled_inspections', 'subscriptions', 'audit_log',
    'booking_requests', 'booking_access_links',
    'tenant_reports', 'tenant_assets', 'tenant_rate_limits'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Check: every row below should show rls_enabled = true.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname not like 'inv\_%'
order by c.relname;
