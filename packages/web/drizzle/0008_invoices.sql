-- Run once in the Supabase SQL editor. Safe to run again.
-- Invoices are written and read only by the website server (admin only), never by the app
-- directly, so row level security is on with no policies and no access for app roles.

create table if not exists public.invoices (
  id text primary key,
  number text not null unique,
  client_user_id text,
  client_name text not null,
  client_address text,
  issue_date timestamp (3) not null default (now() at time zone 'utc'),
  kind text not null default 'custom',
  period_month text,
  lines jsonb not null default '[]'::jsonb,
  total real not null,
  currency text not null default 'GBP',
  status text not null default 'draft',
  created_by text,
  created_at timestamp (3) not null default (now() at time zone 'utc'),
  updated_at timestamp (3) not null default (now() at time zone 'utc'),
  constraint invoices_kind_check check (kind in ('month', 'job', 'custom')),
  constraint invoices_status_check check (status in ('draft', 'sent', 'paid'))
);
create index if not exists invoices_client_idx on public.invoices (client_user_id);
create index if not exists invoices_issue_idx on public.invoices (issue_date);

alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
