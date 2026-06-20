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
  amount         text not null,
  status         text not null,
  tx_hash        text,
  network        text not null,
  created_at     timestamptz not null default now()
);

create table if not exists receipts (
  id            uuid primary key default gen_random_uuid(),
  payment_id    text not null,
  service_slug  text not null,
  payer         text not null,
  amount        text not null,
  result_hash   text not null,
  rating        int,
  onchain_tx    text,
  block_number  int,
  created_at    timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists receipts_service_slug_idx on receipts(service_slug);
create index if not exists receipts_payer_idx on receipts(payer);
create index if not exists payments_service_slug_idx on payments(service_slug);
create index if not exists services_seller_address_idx on services(seller_address);

-- Disable RLS (server-side only access via service_role key)
alter table services disable row level security;
alter table payments disable row level security;
alter table receipts disable row level security;
