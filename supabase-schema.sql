-- AuraGate schema — run once in Supabase SQL Editor

create table if not exists services (
  slug            text primary key,
  name            text not null,
  description     text not null,
  category        text not null,
  seller_address  text not null,
  seller_name     text not null,
  price           text not null,
  method          text not null default 'GET',
  endpoint        text not null,
  external_url    text,
  docs_url        text,
  tags            text[],
  sample_response jsonb,
  verified        boolean not null default false,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  service_slug   text not null,
  buyer_address  text not null,
  seller_address text,
  amount         text not null,
  status         text not null,
  tx_hash        text,
  network        text not null,
  asset          text,
  mode           text not null default 'testnet',
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists receipts (
  id            uuid primary key default gen_random_uuid(),
  payment_id    text not null,
  service_slug  text not null,
  payer         text not null,
  seller_address text,
  amount        text not null,
  request_hash  text,
  result_hash   text not null,
  rating        int,
  onchain_tx    text,
  block_number  int,
  mode          text not null default 'testnet',
  settlement_ref text,
  contract_address text,
  created_at    timestamptz not null default now()
);

create table if not exists pending_buys (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null,
  price          text not null,
  seller_address text not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null
);

-- Idempotent upgrades for existing AuraGate deployments.
alter table payments add column if not exists seller_address text;
alter table payments add column if not exists asset text;
alter table payments add column if not exists mode text not null default 'testnet';
alter table payments add column if not exists verified_at timestamptz;
alter table receipts add column if not exists seller_address text;
alter table receipts add column if not exists request_hash text;
alter table receipts add column if not exists mode text not null default 'testnet';
alter table receipts add column if not exists settlement_ref text;
alter table receipts add column if not exists contract_address text;

-- Indexes for common queries
create index if not exists receipts_service_slug_idx on receipts(service_slug);
create index if not exists receipts_payer_idx on receipts(payer);
create index if not exists payments_service_slug_idx on payments(service_slug);
create index if not exists services_seller_address_idx on services(seller_address);
create index if not exists payments_mode_idx on payments(mode);
create index if not exists receipts_mode_idx on receipts(mode);
create index if not exists pending_buys_expires_at_idx on pending_buys(expires_at);
create unique index if not exists receipts_settlement_ref_unique_idx
  on receipts(settlement_ref)
  where settlement_ref is not null and settlement_ref <> '';

-- Constraints for mainnet hygiene. If these fail on old data, clean the rows
-- then re-run this section.
do $$
begin
  alter table payments add constraint payments_status_chk
    check (status in ('settled', 'pending', 'failed'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table payments add constraint payments_mode_chk
    check (mode in ('mock', 'testnet', 'mainnet'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table receipts add constraint receipts_mode_chk
    check (mode in ('mock', 'testnet', 'mainnet'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table receipts add constraint receipts_rating_chk
    check (rating is null or (rating >= 1 and rating <= 5));
exception when duplicate_object then null;
end $$;

-- Disable RLS (server-side only access via service_role key)
alter table services disable row level security;
alter table payments disable row level security;
alter table receipts disable row level security;
alter table pending_buys disable row level security;
