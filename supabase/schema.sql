-- Run ONCE in Supabase > SQL Editor > New query > paste all > Run.
-- Safe to run again (it only creates what is missing).

create table if not exists stock (
  id uuid primary key default gen_random_uuid(),
  brand text, model text, cpu text, generation text,
  ram_gb int, storage_gb int, storage_type text,
  price_aed numeric not null,
  qty int not null default 1,
  location text, seller_name text, seller_whatsapp text,
  source_group_name text, raw_text text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  is_active boolean not null default true
);
create index if not exists stock_active_idx on stock (is_active, expires_at);

-- CONSENT LOG: one row per consent decision. A withdrawal is a NEW row with NO (history is kept).
create table if not exists seller_consents (
  id uuid primary key default gen_random_uuid(),
  seller_name text not null,
  seller_whatsapp text,
  group_name text not null,
  consent_status text not null check (consent_status in ('YES','NO')),
  proof_screenshot_url text,
  notes text,
  consent_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_wa_id text not null,
  customer_name text,
  message_text text,
  parsed jsonb,
  matched boolean,
  matched_stock_id uuid references stock(id) on delete set null,
  reply_text text,
  reply_error text,
  connect_requested boolean not null default false,
  wa_message_id text unique,
  created_at timestamptz not null default now()
);
create index if not exists enquiries_created_idx on enquiries (created_at desc);

create table if not exists unfulfilled_requests (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references enquiries(id) on delete set null,
  customer_wa_id text not null,
  requirement_text text not null,
  parsed jsonb,
  note text,
  status text not null default 'open' check (status in ('open','forwarded','replied','closed')),
  created_at timestamptz not null default now()
);

-- Lock every table: only our server (service_role key) can read/write. No public access.
alter table stock enable row level security;
alter table seller_consents enable row level security;
alter table enquiries enable row level security;
alter table unfulfilled_requests enable row level security;

-- ===================== v2: sellers, drafts, channels, website =====================
create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  whatsapp text not null unique,          -- digits only incl. country code, e.g. 971501234567
  email text,
  auth_user_id uuid unique,               -- Supabase Auth user for portal login (optional)
  status text not null default 'approved' check (status in ('pending','approved','suspended')),
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table stock add column if not exists seller_id uuid references sellers(id) on delete set null;
alter table stock add column if not exists source text not null default 'admin';   -- admin | portal | whatsapp
alter table enquiries add column if not exists channel text not null default 'whatsapp';
alter table unfulfilled_requests add column if not exists channel text not null default 'whatsapp';

-- Stock read from a seller's WhatsApp message waits here until the seller replies CONFIRM.
create table if not exists inventory_drafts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  items jsonb not null,
  raw_text text,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','expired')),
  created_at timestamptz not null default now()
);
create index if not exists drafts_idx on inventory_drafts (seller_id, status, created_at desc);

-- Stops the same incoming message being processed twice (all channels).
create table if not exists message_log (
  message_id text primary key,
  created_at timestamptz not null default now()
);

-- Simple abuse protection for the public website.
create table if not exists rate_hits (
  id bigserial primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_hits_idx on rate_hits (key, created_at);

alter table sellers enable row level security;
alter table inventory_drafts enable row level security;
alter table message_log enable row level security;
alter table rate_hits enable row level security;
