-- Run once in the Supabase SQL editor (after 0004). Safe to run again.
--
-- Lets an ADMIN see everyone's properties, reports, photos and owner names in the mobile app.
-- READ-ONLY: the existing owner-only rules still decide who may create, change or delete
-- anything, so an admin cannot edit another person's data from the app.
--
-- "Admin" here means profiles.role = 'admin' in the database (the website's ADMIN_EMAILS
-- setting is separate). Mark yourself once with the statement at the bottom of this file.

create or replace function public.app_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not disabled
  )
$$;
revoke all on function public.app_is_admin() from public, anon;
grant execute on function public.app_is_admin() to authenticated;

-- Extra SELECT-only policies. Policies for the same command are OR-ed with the owner rules.
drop policy if exists app_admin_read on public.properties;
create policy app_admin_read on public.properties for select to authenticated using (public.app_is_admin());
drop policy if exists app_admin_read on public.reports;
create policy app_admin_read on public.reports for select to authenticated using (public.app_is_admin());
drop policy if exists app_admin_read on public.rooms;
create policy app_admin_read on public.rooms for select to authenticated using (public.app_is_admin());
drop policy if exists app_admin_read on public.items;
create policy app_admin_read on public.items for select to authenticated using (public.app_is_admin());
drop policy if exists app_admin_read on public.photos;
create policy app_admin_read on public.photos for select to authenticated using (public.app_is_admin());
drop policy if exists app_admin_read on public.meter_readings;
create policy app_admin_read on public.meter_readings for select to authenticated using (public.app_is_admin());
drop policy if exists app_admin_read on public.key_sets;
create policy app_admin_read on public.key_sets for select to authenticated using (public.app_is_admin());
drop policy if exists app_admin_read on public.signatures;
create policy app_admin_read on public.signatures for select to authenticated using (public.app_is_admin());
drop policy if exists app_admin_read on public.profiles;
create policy app_admin_read on public.profiles for select to authenticated using (public.app_is_admin());

-- Photos and signatures live in <owner id>/... folders of the private bucket.
drop policy if exists app_admin_media_read on storage.objects;
create policy app_admin_media_read on storage.objects for select to authenticated
  using (bucket_id = 'inspection-media' and public.app_is_admin());

-- Lists also show who owns each row (null for people who cannot see other profiles).
create or replace view public.app_report_summaries with (security_invoker = true) as
select
  r.id, r.property_id, r.type, r.status, r.reference, r.inspection_date, r.updated_at, r.locked_at,
  p.address_line1, p.postcode, p.city, p.tenant_name, p.landlord_name,
  (select count(*) from public.rooms x where x.report_id = r.id)::int as room_count,
  (select count(*) from public.rooms x where x.report_id = r.id and x.completed)::int as completed_rooms,
  (select count(*) from public.photos x where x.report_id = r.id)::int as photo_count,
  r.user_id as owner_id,
  (select o.name from public.profiles o where o.id::text = r.user_id) as owner_name
from public.reports r
join public.properties p on p.id = r.property_id;

create or replace view public.app_property_summaries with (security_invoker = true) as
select
  p.*,
  (select count(*) from public.reports r where r.property_id = p.id)::int as report_count,
  (select max(r.inspection_date) from public.reports r where r.property_id = p.id) as last_report_at,
  (select o.name from public.profiles o where o.id::text = p.user_id) as owner_name
from public.properties p;

revoke all on public.app_report_summaries, public.app_property_summaries from anon;
grant select on public.app_report_summaries, public.app_property_summaries to authenticated;

-- Make an account an admin (the person cannot do this themselves). Replace the email and run:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- Remove it again with role = 'clerk'.
