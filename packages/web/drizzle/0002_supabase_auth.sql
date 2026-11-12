-- Run once in the Supabase SQL editor (after 0000 and 0001). Safe to run again.
--
-- The website now signs people in with Supabase Auth (Authentication > Users). This adds
-- the `profiles` table that holds what the app stores per person (name, company, phone,
-- role) and a trigger that creates it whenever someone signs up.
--
-- Roles: everyone starts as 'clerk'. A sign-up may request 'agency' or 'landlord'; anything
-- else (including 'admin') is ignored. Admins are set by you only: put their email in the
-- ADMIN_EMAILS setting, or run:  update public.profiles set role = 'admin' where email = '...';

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default '' check (char_length(name) <= 160),
  company_name text check (char_length(company_name) <= 160),
  phone text check (char_length(phone) <= 40),
  role text not null default 'clerk' check (role in ('clerk', 'agency', 'landlord', 'admin')),
  disabled boolean not null default false,
  created_at timestamp(3) not null default now(),
  updated_at timestamp(3) not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, email, name, company_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)), 160),
    left(nullif(new.raw_user_meta_data ->> 'company_name', ''), 160),
    case when requested in ('agency', 'landlord') then requested else 'clerk' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the email copy in step when someone changes their address.
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, ''), updated_at = now() where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.sync_profile_email();

-- People who already signed up before this migration get a profile too.
insert into public.profiles (id, email, name)
select u.id, coalesce(u.email, ''), left(coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(coalesce(u.email, ''), '@', 1)), 160)
from auth.users u
on conflict (id) do nothing;

-- Only the website's server reads this table (as the `postgres` role, which ignores
-- row-level security). Switching RLS on with no policies closes Supabase's public API to it.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

-- The old Better Auth tables are no longer used. They are left in place so nothing is lost;
-- once you are happy with the new login you can remove them:
--   drop table if exists public."session", public.account, public.verification, public."user" cascade;
