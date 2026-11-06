-- =====================================================================
-- 0001_initial_schema.sql
-- Multi-business AI customer service platform: core tables and security.
--
-- TENANT ISOLATION RULES BUILT INTO THIS FILE
--  1. Every table (except businesses) has business_id.
--  2. Links between tables use COMPOSITE foreign keys that include
--     business_id, so the database refuses cross-business links even
--     when the backend uses the service-role key (which bypasses RLS).
--  3. Row Level Security is ON for every table with NO policies, and
--     public roles (anon, authenticated) have all privileges revoked.
--     Only the backend (service_role key) can touch the data.
-- =====================================================================

create extension if not exists btree_gist;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  industry text not null,
  timezone text not null default 'Australia/Melbourne',
  currency text not null default 'AUD',
  ai_personality text,
  custom_instructions text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- business_api_keys: public keys for the future chat widget.
-- Only a SHA-256 hash is stored, never the key itself.
-- ---------------------------------------------------------------------
create table public.business_api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  label text,
  allowed_origins text[] not null default '{}',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.business_api_keys (business_id);

-- ---------------------------------------------------------------------
-- business_hours: 0 = Sunday ... 6 = Saturday. A closed day has no rows.
-- Several rows per day allow lunch breaks. Times are in the business timezone.
-- ---------------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  check (close_time > open_time)
);
create index on public.business_hours (business_id, day_of_week);

-- ---------------------------------------------------------------------
-- services (price stored in cents to avoid rounding errors)
-- ---------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create index on public.services (business_id);

-- ---------------------------------------------------------------------
-- faqs and policies
-- ---------------------------------------------------------------------
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  question text not null,
  answer text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.faqs (business_id);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  content text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.policies (business_id);

-- ---------------------------------------------------------------------
-- booking_resources: the thing that can only be in one place at a time
-- (a stylist, a room, a court). Every booking belongs to exactly one.
-- ---------------------------------------------------------------------
create table public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create index on public.booking_resources (business_id);

-- ---------------------------------------------------------------------
-- booking_provider_configs: which booking software a business uses.
-- One provider per business for now. "test" is the built-in test adapter.
-- NOTE: when real providers are added, secret credentials must NOT be
-- stored here in plain text (we will encrypt them or use a secrets store).
-- ---------------------------------------------------------------------
create table public.booking_provider_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  provider_type text not null default 'test',
  mode text not null default 'test' check (mode in ('test', 'live')),
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (provider_type <> 'test' or mode = 'test')
);

-- ---------------------------------------------------------------------
-- conversations and messages
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel text not null default 'api',
  customer_ref text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (business_id, id)
);
create index on public.conversations (business_id, last_message_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('customer', 'assistant')),
  content text not null check (length(content) <= 8000),
  created_at timestamptz not null default now(),
  foreign key (business_id, conversation_id)
    references public.conversations (business_id, id) on delete cascade
);
create index on public.messages (business_id, conversation_id, created_at);

-- ---------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  resource_id uuid not null,
  service_id uuid not null,
  conversation_id uuid,
  customer_name text not null,
  customer_contact text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  provider_type text not null default 'test',
  external_booking_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint bookings_valid_time check (ends_at > starts_at),
  foreign key (business_id, resource_id)
    references public.booking_resources (business_id, id),
  foreign key (business_id, service_id)
    references public.services (business_id, id),
  foreign key (business_id, conversation_id)
    references public.conversations (business_id, id)
);
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();
create index on public.bookings (business_id, starts_at);

-- THE DOUBLE-BOOKING GUARD: Postgres itself refuses two CONFIRMED bookings
-- for the same business + resource whose time ranges overlap.
-- '[)' = start included, end excluded, so back-to-back bookings are fine.
-- Cancelled bookings are ignored, so cancelling frees the slot.
alter table public.bookings
  add constraint bookings_no_double_booking
  exclude using gist (
    business_id with =,
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'confirmed');

-- ---------------------------------------------------------------------
-- usage_events: basic cost tracking per business
-- ---------------------------------------------------------------------
create table public.usage_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (business_id, conversation_id)
    references public.conversations (business_id, id) on delete cascade
);
create index on public.usage_events (business_id, created_at);

-- ---------------------------------------------------------------------
-- SECURITY: RLS on for every table, no policies, public roles locked out.
-- The backend uses the service-role/secret key, which bypasses RLS.
-- ---------------------------------------------------------------------
alter table public.businesses                enable row level security;
alter table public.business_api_keys         enable row level security;
alter table public.business_hours            enable row level security;
alter table public.services                  enable row level security;
alter table public.faqs                      enable row level security;
alter table public.policies                  enable row level security;
alter table public.booking_resources         enable row level security;
alter table public.booking_provider_configs  enable row level security;
alter table public.conversations             enable row level security;
alter table public.messages                  enable row level security;
alter table public.bookings                  enable row level security;
alter table public.usage_events              enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Quick check: every row below should show rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
