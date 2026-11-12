-- Run once in the Supabase SQL editor, AFTER 0000, 0002 and 0003. Safe to run again.
--
-- Goal: the website and the Flutter app work on the SAME data. A building, report, photo or
-- signature created in either appears in the other.
--
-- How: the app signs in with Supabase Auth and talks to Supabase directly, using the website's
-- tables (properties, reports, rooms, items, photos, meter_readings, key_sets, signatures, profiles).
-- The website's server keeps connecting as the `postgres` role, which ignores the rules below.
-- The rules below apply to the app (the `authenticated` role) and make the database itself enforce:
--   * a person only sees and changes their own rows (row-level security),
--   * rooms / items / photos must belong to a report of the same person,
--   * a signed report is locked: nothing in it can change,
--   * roles cannot be changed by the person, photos live in their own private folder.
-- Photos and signatures are stored in the private Storage bucket `inspection-media`, in a folder
-- named after the user's id.

------------------------------------------------------------------ ids, defaults, indexes
-- The website creates ids and timestamps in code; the app relies on the database to do it.

create or replace function public.app_new_id(prefix text) returns text
language sql volatile set search_path = '' as $$
  select prefix || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
$$;

alter table public.properties
  alter column id set default public.app_new_id('prp'),
  alter column user_id set default auth.uid()::text,
  alter column created_at set default (now() at time zone 'utc'),
  alter column updated_at set default (now() at time zone 'utc');
alter table public.reports
  alter column id set default public.app_new_id('rep'),
  alter column user_id set default auth.uid()::text,
  alter column inspection_date set default (now() at time zone 'utc'),
  alter column created_at set default (now() at time zone 'utc'),
  alter column updated_at set default (now() at time zone 'utc');
alter table public.rooms
  alter column id set default public.app_new_id('rm'),
  alter column created_at set default (now() at time zone 'utc'),
  alter column updated_at set default (now() at time zone 'utc');
alter table public.items
  alter column id set default public.app_new_id('itm'),
  alter column created_at set default (now() at time zone 'utc'),
  alter column updated_at set default (now() at time zone 'utc');
alter table public.photos
  alter column id set default public.app_new_id('pho'),
  alter column created_at set default (now() at time zone 'utc');
alter table public.meter_readings
  alter column id set default public.app_new_id('mtr'),
  alter column created_at set default (now() at time zone 'utc');
alter table public.key_sets
  alter column id set default public.app_new_id('key'),
  alter column created_at set default (now() at time zone 'utc');
alter table public.signatures
  alter column id set default public.app_new_id('sig'),
  alter column signed_at set default (now() at time zone 'utc');

-- The app retries uploads safely: a photo is identified by (report, client id), a signature by (report, role).
create unique index if not exists photos_report_client_uidx on public.photos (report_id, client_id);
delete from public.signatures a using public.signatures b
  where a.report_id = b.report_id and a.signer_role = b.signer_role
    and (a.signed_at, a.id) < (b.signed_at, b.id);
create unique index if not exists signatures_report_role_uidx on public.signatures (report_id, signer_role);

------------------------------------------------------------------ ownership helpers

create or replace function public.app_owns_report(rid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports where id = rid and user_id = auth.uid()::text)
$$;

create or replace function public.app_owns_property(pid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.properties where id = pid and user_id = auth.uid()::text)
$$;

create or replace function public.app_room_in_report(room text, report text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rooms where id = room and report_id = report)
$$;

create or replace function public.app_item_in_report(item text, report text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.items where id = item and report_id = report)
$$;

create or replace function public.app_report_has_property(report text, property text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports where id = report and property_id = property)
$$;

------------------------------------------------------------------ locking and integrity triggers
-- These fire for the app only (auth.uid() is null for the website's server, which enforces the
-- same rules in its own code), so the website is unaffected.

create or replace function public.app_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := (now() at time zone 'utc');
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['properties', 'reports', 'rooms', 'items'] loop
    execute format('drop trigger if exists %I on public.%I', 'app_' || t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.app_touch()', 'app_' || t || '_touch', t);
  end loop;
end $$;

create or replace function public.app_assert_unlocked(rid text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.reports where id = rid and locked_at is not null) then
    raise exception 'This report is signed and locked. Changes are not allowed.' using errcode = 'PT409';
  end if;
end $$;

create or replace function public.app_guard_locked_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rid text;
begin
  rid := case when tg_op = 'DELETE' then old.report_id else new.report_id end;
  if auth.uid() is not null and rid is not null then
    perform public.app_assert_unlocked(rid);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['rooms', 'items', 'photos', 'meter_readings', 'key_sets', 'signatures'] loop
    execute format('drop trigger if exists %I on public.%I', 'app_' || t || '_lock', t);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.app_guard_locked_child()',
      'app_' || t || '_lock', t);
  end loop;
end $$;

create or replace function public.app_guard_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.locked_at := null;
    new.completed_at := null;
    return new;
  end if;

  if old.locked_at is not null then
    raise exception 'This report is signed and locked. Changes are not allowed.' using errcode = 'PT409';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;

  -- Only app_finalise_report may lock a report or mark it signed.
  if coalesce(current_setting('app.finalising', true), '') <> 'on' then
    new.locked_at := null;
    if new.status = 'signed' then
      raise exception 'A report is signed by locking it.' using errcode = 'PT400';
    end if;
  end if;
  new.user_id := old.user_id;
  new.property_id := old.property_id;
  new.type := old.type;
  new.base_report_id := old.base_report_id;
  new.reference := old.reference;
  return new;
end $$;

drop trigger if exists app_reports_guard on public.reports;
create trigger app_reports_guard before insert or update or delete on public.reports
  for each row execute function public.app_guard_report();

------------------------------------------------------------------ row-level security for the app

alter table public.properties enable row level security;
alter table public.reports enable row level security;
alter table public.rooms enable row level security;
alter table public.items enable row level security;
alter table public.photos enable row level security;
alter table public.meter_readings enable row level security;
alter table public.key_sets enable row level security;
alter table public.signatures enable row level security;
alter table public.profiles enable row level security;

drop policy if exists app_properties_all on public.properties;
create policy app_properties_all on public.properties for all to authenticated
  using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists app_reports_all on public.reports;
create policy app_reports_all on public.reports for all to authenticated
  using (user_id = auth.uid()::text)
  with check (
    user_id = auth.uid()::text
    and public.app_owns_property(property_id)
    and (base_report_id is null or public.app_owns_report(base_report_id))
  );

drop policy if exists app_rooms_all on public.rooms;
create policy app_rooms_all on public.rooms for all to authenticated
  using (public.app_owns_report(report_id)) with check (public.app_owns_report(report_id));

drop policy if exists app_items_all on public.items;
create policy app_items_all on public.items for all to authenticated
  using (public.app_owns_report(report_id))
  with check (public.app_owns_report(report_id) and public.app_room_in_report(room_id, report_id));

drop policy if exists app_photos_all on public.photos;
create policy app_photos_all on public.photos for all to authenticated
  using (report_id is not null and public.app_owns_report(report_id))
  with check (
    report_id is not null
    and public.app_owns_report(report_id)
    and public.app_report_has_property(report_id, property_id)
    and (room_id is null or public.app_room_in_report(room_id, report_id))
    and (item_id is null or public.app_item_in_report(item_id, report_id))
  );

do $$
declare t text;
begin
  foreach t in array array['meter_readings', 'key_sets', 'signatures'] loop
    execute format('drop policy if exists %I on public.%I', 'app_' || t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.app_owns_report(report_id)) with check (public.app_owns_report(report_id))',
      'app_' || t || '_all', t);
  end loop;
end $$;

-- A person can read their own profile and change only their name, company and phone (never the role).
drop policy if exists app_profiles_select on public.profiles;
create policy app_profiles_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists app_profiles_update on public.profiles;
create policy app_profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.properties, public.reports, public.rooms, public.items, public.photos, public.meter_readings,
  public.key_sets, public.signatures, public.profiles from anon;
grant select, insert, update, delete on public.properties, public.reports, public.rooms, public.items, public.photos,
  public.meter_readings, public.key_sets, public.signatures to authenticated;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (name, company_name, phone) on public.profiles to authenticated;

------------------------------------------------------------------ list views (run with the caller's rights)

create or replace view public.app_report_summaries with (security_invoker = true) as
select
  r.id, r.property_id, r.type, r.status, r.reference, r.inspection_date, r.updated_at, r.locked_at,
  p.address_line1, p.postcode, p.city, p.tenant_name, p.landlord_name,
  (select count(*) from public.rooms x where x.report_id = r.id)::int as room_count,
  (select count(*) from public.rooms x where x.report_id = r.id and x.completed)::int as completed_rooms,
  (select count(*) from public.photos x where x.report_id = r.id)::int as photo_count
from public.reports r
join public.properties p on p.id = r.property_id;

create or replace view public.app_property_summaries with (security_invoker = true) as
select
  p.*,
  (select count(*) from public.reports r where r.property_id = p.id)::int as report_count,
  (select max(r.inspection_date) from public.reports r where r.property_id = p.id) as last_report_at
from public.properties p;

revoke all on public.app_report_summaries, public.app_property_summaries from anon;
grant select on public.app_report_summaries, public.app_property_summaries to authenticated;

------------------------------------------------------------------ standard rooms

create table if not exists public.app_room_templates (
  type text primary key,
  name text not null,
  items text[] not null
);

insert into public.app_room_templates (type, name, items)
select t.type, t.name, case when t.with_fabric then fabric.items || t.extra else t.extra end
from (select array['Walls', 'Ceiling', 'Floor / Floor covering', 'Skirting', 'Doors & frames', 'Windows & sills',
                   'Window coverings', 'Lighting', 'Electrical sockets & switches', 'Heating / Radiators'] as items) fabric,
(values
  ('entrance', 'Entrance / Hallway', true, array['Front door & security', 'Entry phone', 'Smoke alarm', 'Meter cupboard', 'Storage']),
  ('living_room', 'Living Room', true, array['Sofas & chairs', 'Tables', 'Shelving & storage', 'Fireplace', 'TV point', 'Decorative items']),
  ('kitchen', 'Kitchen', true, array['Worktops', 'Units & cupboards', 'Sink & taps', 'Splashback / Tiling', 'Oven & hob', 'Extractor',
     'Fridge / Freezer', 'Washing machine', 'Dishwasher', 'Microwave', 'Boiler', 'Crockery & utensils']),
  ('dining_room', 'Dining Room', true, array['Dining table', 'Dining chairs', 'Sideboard / Storage']),
  ('bedroom', 'Bedroom', true, array['Bed frame', 'Mattress', 'Wardrobe', 'Chest of drawers', 'Bedside tables', 'Mirror']),
  ('bathroom', 'Bathroom', true, array['Bath', 'Shower & screen', 'Shower head & hose', 'Basin & taps', 'WC & cistern', 'Tiling & grout',
     'Sealant', 'Extractor fan', 'Towel rail', 'Mirror / Cabinet']),
  ('ensuite', 'Ensuite', true, array['Shower & screen', 'Basin & taps', 'WC & cistern', 'Tiling & grout', 'Sealant', 'Extractor fan']),
  ('wc', 'Cloakroom / WC', true, array['Basin & taps', 'WC & cistern', 'Extractor fan']),
  ('utility', 'Utility Room', true, array['Worktops', 'Units', 'Sink & taps', 'Washing machine', 'Tumble dryer', 'Boiler']),
  ('stairs', 'Stairs & Landing', true, array['Bannister & spindles', 'Stair covering', 'Loft hatch', 'Airing cupboard']),
  ('garden', 'Garden', false, array['Lawn', 'Borders & planting', 'Patio / Decking', 'Fencing & gates', 'Shed / Outbuilding', 'Outside tap', 'Bins', 'Garden furniture']),
  ('garage', 'Garage', false, array['Walls', 'Ceiling', 'Floor', 'Garage door', 'Lighting', 'Electrical sockets', 'Storage']),
  ('parking', 'Parking / Driveway', false, array['Surface', 'Markings', 'Gates / Barrier', 'Lighting']),
  ('exterior', 'Exterior & Communal', false, array['Front elevation', 'Rear elevation', 'Roof (visible)', 'Guttering & downpipes', 'External doors', 'External windows', 'Communal areas']),
  ('custom', 'Other room', true, array[]::text[])
) as t (type, name, with_fabric, extra)
on conflict (type) do update set name = excluded.name, items = excluded.items;

alter table public.app_room_templates enable row level security;
drop policy if exists app_room_templates_read on public.app_room_templates;
create policy app_room_templates_read on public.app_room_templates for select to authenticated using (true);
revoke all on public.app_room_templates from anon;
grant select on public.app_room_templates to authenticated;

------------------------------------------------------------------ functions the app calls

create or replace function public.app_template_items(p_type text) returns text[]
language sql stable set search_path = '' as $$
  select coalesce((select items from public.app_room_templates where type = p_type), array[]::text[])
$$;

create or replace function public.app_add_room(p_report text, p_name text, p_type text default 'custom') returns text
language plpgsql set search_path = '' as $$
declare
  rid text;
  next_order int;
  item_name text;
  i int := 0;
begin
  if not exists (select 1 from public.reports where id = p_report) then
    raise exception 'Report not found' using errcode = 'PT404';
  end if;
  select coalesce(max(sort_order), -1) + 1 into next_order from public.rooms where report_id = p_report;
  insert into public.rooms (report_id, name, room_type, sort_order)
  values (p_report, p_name, coalesce(nullif(p_type, ''), 'custom'), next_order)
  returning id into rid;
  foreach item_name in array public.app_template_items(coalesce(nullif(p_type, ''), 'custom')) loop
    insert into public.items (report_id, room_id, name, sort_order) values (p_report, rid, item_name, i);
    i := i + 1;
  end loop;
  return rid;
end $$;

create or replace function public.app_create_report(
  p_property text,
  p_type text,
  p_base text default null,
  p_tenant_present boolean default false,
  p_date timestamptz default null
) returns text
language plpgsql set search_path = '' as $$
declare
  prop public.properties;
  base public.reports;
  rid text;
  ref text;
  prefix text;
  n int;
  old_room record;
  new_room text;
  clerk text;
begin
  select * into prop from public.properties where id = p_property;
  if not found then
    raise exception 'Property not found' using errcode = 'PT404';
  end if;
  if p_type not in ('check_in', 'check_out', 'mid_term') then
    raise exception 'Unknown report type' using errcode = 'PT400';
  end if;
  if p_base is not null then
    select * into base from public.reports where id = p_base;
    if not found then
      raise exception 'Comparison report not found' using errcode = 'PT404';
    end if;
    if base.property_id <> p_property then
      raise exception 'The comparison report belongs to a different property' using errcode = 'PT400';
    end if;
  end if;

  prefix := case p_type when 'check_in' then 'CI' when 'check_out' then 'CO' else 'MT' end;
  ref := prefix || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  select name into clerk from public.profiles where id = auth.uid();

  insert into public.reports (property_id, type, reference, base_report_id, inspection_date, tenant_present, clerk_name, clerk_email)
  values (p_property, p_type, ref, case when p_type = 'check_out' then p_base end,
          (coalesce(p_date, now()) at time zone 'utc'), coalesce(p_tenant_present, false), clerk, auth.jwt() ->> 'email')
  returning id into rid;

  if p_type = 'check_out' and p_base is not null then
    -- A check-out starts from the earlier report's rooms and items.
    for old_room in select * from public.rooms where report_id = p_base order by sort_order loop
      insert into public.rooms (report_id, name, room_type, sort_order)
      values (rid, old_room.name, old_room.room_type, old_room.sort_order)
      returning id into new_room;
      insert into public.items (report_id, room_id, name, sort_order, quantity, previous_item_id, change_status)
      select rid, new_room, name, sort_order, quantity, id, 'unchanged'
      from public.items where room_id = old_room.id order by sort_order;
    end loop;
  else
    perform public.app_add_room(rid, 'Entrance / Hallway', 'entrance');
    perform public.app_add_room(rid, 'Living Room', 'living_room');
    perform public.app_add_room(rid, 'Kitchen', 'kitchen');
    for n in 1..greatest(prop.bedrooms, 0) loop
      perform public.app_add_room(rid, 'Bedroom ' || n, 'bedroom');
    end loop;
    for n in 1..greatest(prop.bathrooms, 0) loop
      perform public.app_add_room(rid, case when prop.bathrooms > 1 then 'Bathroom ' || n else 'Bathroom' end, 'bathroom');
    end loop;
    perform public.app_add_room(rid, 'Exterior & Communal', 'exterior');
  end if;
  return rid;
end $$;

create or replace function public.app_finalise_report(p_report text) returns void
language plpgsql set search_path = '' as $$
declare r public.reports;
begin
  select * into r from public.reports where id = p_report;
  if not found then
    raise exception 'Report not found' using errcode = 'PT404';
  end if;
  if r.locked_at is not null then
    return;
  end if;
  if not exists (select 1 from public.signatures where report_id = p_report) then
    raise exception 'At least one signature is required before locking.' using errcode = 'PT400';
  end if;
  perform set_config('app.finalising', 'on', true);
  update public.reports
     set status = 'signed', locked_at = (now() at time zone 'utc'), completed_at = coalesce(completed_at, (now() at time zone 'utc'))
   where id = p_report;
  perform set_config('app.finalising', 'off', true);
end $$;

-- One request saves a whole room and its items (what the app's offline queue sends).
create or replace function public.app_save_room(p_room text, p_room_values jsonb, p_items jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  it jsonb;
  n int;
begin
  update public.rooms
     set condition = p_room_values ->> 'condition',
         cleanliness = p_room_values ->> 'cleanliness',
         notes = p_room_values ->> 'notes',
         completed = coalesce((p_room_values ->> 'completed')::boolean, completed)
   where id = p_room;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Room not found' using errcode = 'PT404';
  end if;
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update public.items
       set condition = it ->> 'condition',
           cleanliness = it ->> 'cleanliness',
           description = it ->> 'description',
           notes = it ->> 'notes',
           change_status = it ->> 'changeStatus'
     where id = (it ->> 'id') and room_id = p_room;
  end loop;
end $$;

create or replace function public.app_save_meters(p_report text, p_rows jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.reports where id = p_report) then
    raise exception 'Report not found' using errcode = 'PT404';
  end if;
  delete from public.meter_readings where report_id = p_report;
  insert into public.meter_readings (report_id, meter_type, serial_number, reading, location, notes)
  select p_report, r ->> 'meterType', r ->> 'serialNumber', r ->> 'reading', r ->> 'location', r ->> 'notes'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
end $$;

create or replace function public.app_save_keys(p_report text, p_rows jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.reports where id = p_report) then
    raise exception 'Report not found' using errcode = 'PT404';
  end if;
  delete from public.key_sets where report_id = p_report;
  insert into public.key_sets (report_id, description, quantity, notes)
  select p_report, r ->> 'description', coalesce((r ->> 'quantity')::int, 1), r ->> 'notes'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
end $$;

revoke execute on function public.app_template_items(text), public.app_add_room(text, text, text),
  public.app_create_report(text, text, text, boolean, timestamptz), public.app_finalise_report(text),
  public.app_save_room(text, jsonb, jsonb), public.app_save_meters(text, jsonb), public.app_save_keys(text, jsonb)
  from public, anon;
grant execute on function public.app_template_items(text), public.app_add_room(text, text, text),
  public.app_create_report(text, text, text, boolean, timestamptz), public.app_finalise_report(text),
  public.app_save_room(text, jsonb, jsonb), public.app_save_meters(text, jsonb), public.app_save_keys(text, jsonb)
  to authenticated;

------------------------------------------------------------------ photo and signature storage
-- Files live under <user id>/..., and a user can only reach their own folder. The website's server
-- reaches the same files with its storage access keys.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-media', 'inspection-media', false, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists inv_media_select on storage.objects;
drop policy if exists app_media_select on storage.objects;
create policy app_media_select on storage.objects for select to authenticated
  using (bucket_id = 'inspection-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists inv_media_insert on storage.objects;
drop policy if exists app_media_insert on storage.objects;
create policy app_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists inv_media_update on storage.objects;
drop policy if exists app_media_update on storage.objects;
create policy app_media_update on storage.objects for update to authenticated
  using (bucket_id = 'inspection-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'inspection-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists inv_media_delete on storage.objects;
drop policy if exists app_media_delete on storage.objects;
create policy app_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'inspection-media' and (storage.foldername(name))[1] = auth.uid()::text);
