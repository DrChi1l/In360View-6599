-- Run once in the Supabase SQL editor, AFTER 0008. Safe to run again.
-- Links a property to the agency account it is managed for, so the agency portal can show its
-- jobs and invoices. Set automatically when a booking is converted (by matching the booking's
-- contact email to an agency account), or by an admin on the property form.

alter table public.properties add column if not exists agency_user_id text;
create index if not exists properties_agency_idx on public.properties (agency_user_id) where agency_user_id is not null;

-- Existing properties made from bookings: the booking contact was stored as the landlord email.
update public.properties pr
set agency_user_id = p.id::text
from public.profiles p
where pr.agency_user_id is null
  and p.role = 'agency'
  and pr.landlord_email is not null
  and lower(pr.landlord_email) = lower(p.email);
