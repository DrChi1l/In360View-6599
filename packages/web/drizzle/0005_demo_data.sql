-- Two demo inspections in the shared tables, so they appear in BOTH the website and the app.
-- Nothing is bundled in either app: this lives only in your Supabase database.
--
-- Run AFTER 0004_app_access.sql, and after you have signed up once (on the website or in the app).
-- Then run, with that account's email:
--
--     select public.app_seed_demo('you@example.com');
--
-- Remove the demos later with:
--     delete from public.properties where reference like 'DEMO-%';
--     (and their reports/rooms/items: see the end of this file)
--
-- Demo 1: a completed check-in with graded rooms, meters and keys.
-- Demo 2: a draft mid-term inspection, partly filled in.

create or replace function public.app_seed_demo(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
  clerk text;
  prop1 text; prop2 text;
  rep1 text; rep2 text;
  def record;
  rid text;
  item_name text;
  i int;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    raise exception 'No account with email %. Sign up first.', p_email;
  end if;
  select name into clerk from public.profiles where id = uid;

  insert into public.properties (user_id, reference, address_line1, city, postcode, property_type, furnishing, bedrooms, bathrooms,
    landlord_name, landlord_email, tenant_name, tenant_email, notes)
  values (uid::text, 'DEMO-1', '130 Long Lane', 'Hillingdon', 'UB10 0EH', 'Terraced house', 'Unfurnished', 2, 1,
    'R. Chandra', 'landlord@example.com', 'J. Okafor', 'tenant@example.com', 'Demo property. Key safe by the front door.')
  returning id into prop1;
  insert into public.properties (user_id, reference, address_line1, city, postcode, property_type, furnishing, bedrooms, bathrooms,
    landlord_name, tenant_name)
  values (uid::text, 'DEMO-2', 'Flat 4, 21 Mill Road', 'High Wycombe', 'HP11 2AB', 'Flat / Apartment', 'Part furnished', 1, 1,
    'Mill Road Lettings', 'S. Patel')
  returning id into prop2;

  insert into public.reports (user_id, property_id, type, status, reference, inspection_date, clerk_name, clerk_email,
    tenant_present, weather, general_condition, general_cleanliness, summary_notes, maintenance_issues, completed_at)
  values (uid::text, prop1, 'check_in', 'completed', 'CI-DEMO01', (now() at time zone 'utc') - interval '2 days', clerk, p_email,
    true, 'Dry, overcast', 'good', 'clean', 'Property presented in very good decorative order.', 'Kitchen extractor fan is noisy in use.',
    (now() at time zone 'utc') - interval '2 days')
  returning id into rep1;
  insert into public.reports (user_id, property_id, type, status, reference, inspection_date, clerk_name, clerk_email, tenant_present)
  values (uid::text, prop2, 'mid_term', 'draft', 'MT-DEMO02', now() at time zone 'utc', clerk, p_email, true)
  returning id into rep2;

  for def in
    select * from (values
      (rep1, 'Entrance / Hallway', 'entrance', 0), (rep1, 'Living Room', 'living_room', 1), (rep1, 'Kitchen', 'kitchen', 2),
      (rep1, 'Bedroom 1', 'bedroom', 3), (rep1, 'Bedroom 2', 'bedroom', 4), (rep1, 'Bathroom', 'bathroom', 5),
      (rep1, 'Exterior & Communal', 'exterior', 6),
      (rep2, 'Entrance / Hallway', 'entrance', 0), (rep2, 'Living Room', 'living_room', 1), (rep2, 'Kitchen', 'kitchen', 2),
      (rep2, 'Bedroom', 'bedroom', 3), (rep2, 'Bathroom', 'bathroom', 4)
    ) as v (report_id, name, room_type, sort_order)
  loop
    insert into public.rooms (report_id, name, room_type, sort_order) values (def.report_id, def.name, def.room_type, def.sort_order)
    returning id into rid;
    i := 0;
    foreach item_name in array coalesce((select items from public.app_room_templates where type = def.room_type), array[]::text[]) loop
      insert into public.items (report_id, room_id, name, sort_order) values (def.report_id, rid, item_name, i);
      i := i + 1;
    end loop;
  end loop;

  update public.rooms set condition = 'good', cleanliness = 'clean', completed = true where report_id = rep1;
  update public.items set condition = 'good', cleanliness = 'clean' where report_id = rep1;
  update public.items set condition = 'fair', description = 'White painted ceiling (crack near the light unit).'
    where report_id = rep1 and name = 'Ceiling' and room_id = (select id from public.rooms where report_id = rep1 and room_type = 'entrance');
  update public.items set description = 'White painted walls (screw in the wall).'
    where report_id = rep1 and name = 'Walls' and room_id = (select id from public.rooms where report_id = rep1 and room_type = 'entrance');
  update public.items set condition = 'poor', description = 'Wall-mounted CO alarm above cupboard (button pressed, alarm did not respond).'
    where report_id = rep1 and name = 'Smoke alarm' and room_id = (select id from public.rooms where report_id = rep1 and room_type = 'entrance');

  insert into public.meter_readings (report_id, meter_type, serial_number, reading, location) values
    (rep1, 'electricity', '18K0035132', '23530', 'Cupboard under the stairs'),
    (rep1, 'gas', 'G4K01681061706', '06796', 'Cupboard under the stairs');
  insert into public.key_sets (report_id, description, quantity) values (rep1, 'Silver door keys for the front door', 2);

  update public.rooms set condition = 'good', cleanliness = 'generally_clean', completed = true
    where report_id = rep2 and room_type in ('entrance', 'living_room');
  update public.rooms set notes = 'Mould spotted on the bathroom ceiling. Tenant reports it returns after showers.'
    where report_id = rep2 and room_type = 'bathroom';

  return 'Created 2 demo properties and reports for ' || p_email;
end $$;

-- Only the project owner (SQL editor) may run this; app and website users cannot.
revoke execute on function public.app_seed_demo(text) from public, anon, authenticated;

-- To remove the demos completely:
--   delete from public.meter_readings where report_id in (select id from public.reports where reference like '%-DEMO0_');
--   delete from public.key_sets where report_id in (select id from public.reports where reference like '%-DEMO0_');
--   delete from public.items where report_id in (select id from public.reports where reference like '%-DEMO0_');
--   delete from public.rooms where report_id in (select id from public.reports where reference like '%-DEMO0_');
--   delete from public.reports where reference like '%-DEMO0_';
--   delete from public.properties where reference like 'DEMO-%';
