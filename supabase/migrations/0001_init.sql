-- Air Filter Fulfillment Platform — initial schema (BUILD_SPEC.md Section 3).
-- Not yet applied to a live project; review before running.

create extension if not exists "pgcrypto";

create table if not exists companies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  gr_code              text not null,
  default_filter_size  text,
  address_quirk        text check (address_quirk in ('unit_field_is_address')),
  created_at           timestamptz not null default now()
);

create table if not exists company_aliases (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id) on delete cascade,
  alias       text not null
);

create table if not exists platforms (
  id    uuid primary key default gen_random_uuid(),
  key   text not null unique,
  name  text not null
);

create table if not exists jobs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies (id),
  platform_id     uuid not null references platforms (id),
  output_type     text not null check (output_type in ('shipstation', 'dashboard')),
  status          text not null check (status in ('uploaded', 'processing', 'review', 'complete', 'error')),
  auto_fill_size  boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists job_rows (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs (id) on delete cascade,
  unit_key        text,
  recipient_name  text,
  filter_sizes    text[],
  address1        text,
  address2        text,
  city            text,
  state           text,
  postal_code     text,
  email           text,
  destination     text not null check (destination in ('send', 'flag')),
  flag_reasons    text[],
  raw             jsonb
);

create table if not exists shipment_history (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies (id) on delete cascade,
  recipient_name  text not null,
  imported_at     timestamptz not null default now()
);

create index if not exists idx_company_aliases_company on company_aliases (company_id);
create index if not exists idx_jobs_company on jobs (company_id);
create index if not exists idx_job_rows_job on job_rows (job_id);
create index if not exists idx_shipment_history_company on shipment_history (company_id);
