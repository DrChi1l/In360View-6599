-- Run once in the Supabase SQL editor, AFTER 0004 and 0006. Safe to run again.
--
-- 1. Photos can belong to a meter reading, a set of keys or an alarm check.
-- 2. New table `alarm_checks`: smoke alarm, CO alarm, ... with a status and photos.
-- 3. Meters and keys keep their ids when saved (so their photos stay attached).
-- 4. Tenant review links: remember who a link was sent to and when.

------------------------------------------------------------------ photos on meters, keys, alarms

alter table public.photos
  add column if not exists meter_id text,
  add column if not exists key_id text,
  add column if not exists alarm_id text;
create index if not exists photos_meter_idx on public.photos (meter_id) where meter_id is not null;
create index if not exists photos_key_idx on public.photos (key_id) where key_id is not null;
create index if not exists photos_alarm_idx on public.photos (alarm_id) where alarm_id is not null;

------------------------------------------------------------------ alarm and safety checks

create table if not exists public.alarm_checks (
  id text primary key default public.app_new_id('alm'),
  report_id text not null,
  /** smoke | co | heat | fire_blanket | fire_extinguisher | gas | other */
  alarm_type text not null,
  location text,
  /** working | not_working | missing | not_tested */
  status text,
  notes text,
  created_at timestamp (3) not null default (now() at time zone 'utc'),
  constraint alarm_checks_status_check check (status is null or status in ('working', 'not_working', 'missing', 'not_tested'))
);
create index if not exists alarms_report_idx on public.alarm_checks (report_id);

drop trigger if exists app_alarm_checks_lock on public.alarm_checks;
create trigger app_alarm_checks_lock before insert or update or delete on public.alarm_checks
  for each row execute function public.app_guard_locked_child();

alter table public.alarm_checks enable row level security;
drop policy if exists app_alarm_checks_all on public.alarm_checks;
create policy app_alarm_checks_all on public.alarm_checks for all to authenticated
  using (public.app_owns_report(report_id)) with check (public.app_owns_report(report_id));
drop policy if exists app_admin_read on public.alarm_checks;
create policy app_admin_read on public.alarm_checks for select to authenticated using (public.app_is_admin());

revoke all on public.alarm_checks from anon;
grant select, insert, update, delete on public.alarm_checks to authenticated;

------------------------------------------------------------------ photo policy: meters, keys, alarms
-- The photo must belong to a report of the person (already checked). Ids of meters, keys and
-- alarms are chosen by the app and may arrive before the row itself, so they are not looked up.

------------------------------------------------------------------ save functions that keep ids

create or replace function public.app_save_meters(p_report text, p_rows jsonb) returns void
language plpgsql set search_path = '' as $$
declare keep text[];
begin
  if not exists (select 1 from public.reports where id = p_report) then
    raise exception 'Report not found' using errcode = 'PT404';
  end if;
  select coalesce(array_agg(r ->> 'id') filter (where r ->> 'id' is not null), array[]::text[])
    into keep from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
  delete from public.photos where report_id = p_report and meter_id is not null and not (meter_id = any (keep));
  delete from public.meter_readings where report_id = p_report and not (id = any (keep));
  insert into public.meter_readings (id, report_id, meter_type, serial_number, reading, location, notes)
  select coalesce(r ->> 'id', public.app_new_id('mtr')), p_report, r ->> 'meterType', r ->> 'serialNumber',
         r ->> 'reading', r ->> 'location', r ->> 'notes'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (id) do update
    set meter_type = excluded.meter_type, serial_number = excluded.serial_number, reading = excluded.reading,
        location = excluded.location, notes = excluded.notes
    where public.meter_readings.report_id = p_report;
end $$;

create or replace function public.app_save_keys(p_report text, p_rows jsonb) returns void
language plpgsql set search_path = '' as $$
declare keep text[];
begin
  if not exists (select 1 from public.reports where id = p_report) then
    raise exception 'Report not found' using errcode = 'PT404';
  end if;
  select coalesce(array_agg(r ->> 'id') filter (where r ->> 'id' is not null), array[]::text[])
    into keep from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
  delete from public.photos where report_id = p_report and key_id is not null and not (key_id = any (keep));
  delete from public.key_sets where report_id = p_report and not (id = any (keep));
  insert into public.key_sets (id, report_id, description, quantity, notes)
  select coalesce(r ->> 'id', public.app_new_id('key')), p_report, r ->> 'description',
         coalesce((r ->> 'quantity')::int, 1), r ->> 'notes'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (id) do update
    set description = excluded.description, quantity = excluded.quantity, notes = excluded.notes
    where public.key_sets.report_id = p_report;
end $$;

create or replace function public.app_save_alarms(p_report text, p_rows jsonb) returns void
language plpgsql set search_path = '' as $$
declare keep text[];
begin
  if not exists (select 1 from public.reports where id = p_report) then
    raise exception 'Report not found' using errcode = 'PT404';
  end if;
  select coalesce(array_agg(r ->> 'id') filter (where r ->> 'id' is not null), array[]::text[])
    into keep from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
  delete from public.photos where report_id = p_report and alarm_id is not null and not (alarm_id = any (keep));
  delete from public.alarm_checks where report_id = p_report and not (id = any (keep));
  insert into public.alarm_checks (id, report_id, alarm_type, location, status, notes)
  select coalesce(r ->> 'id', public.app_new_id('alm')), p_report, r ->> 'alarmType', r ->> 'location',
         r ->> 'status', r ->> 'notes'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (id) do update
    set alarm_type = excluded.alarm_type, location = excluded.location, status = excluded.status, notes = excluded.notes
    where public.alarm_checks.report_id = p_report;
end $$;

revoke execute on function public.app_save_meters(text, jsonb), public.app_save_keys(text, jsonb),
  public.app_save_alarms(text, jsonb) from public, anon;
grant execute on function public.app_save_meters(text, jsonb), public.app_save_keys(text, jsonb),
  public.app_save_alarms(text, jsonb) to authenticated;

------------------------------------------------------------------ tenant review links

alter table public.tenant_reports
  add column if not exists sent_to text,
  add column if not exists sent_at timestamp (3);
create index if not exists tenant_reports_source_idx on public.tenant_reports (source_report_id);
