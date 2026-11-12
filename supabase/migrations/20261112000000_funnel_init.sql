-- MamaDances funnel database (Supabase Postgres).
-- Applied by the Supabase GitHub integration, or paste once in the Supabase SQL editor.
-- Buyer data is for fulfillment only (CLAUDE.md, hard rule 3).

create table if not exists orders (
  id               text primary key,          -- Stripe PaymentIntent id
  parent_id        text,                      -- front-end PaymentIntent, for upsells and downsells
  step             text not null,             -- front | carriers27_upsell | season97 | props17_downsell
  items            text not null,             -- comma list: kit27,props17,carriers27,season97
  amount           integer not null,          -- cents
  currency         text not null default 'cad',
  email            text,
  first_name       text,
  lang             text,                      -- fr | en
  variant          text,                      -- headline a | b
  utm              jsonb,
  status           text not null default 'pending_access', -- pending_access | access_granted | refunded
  created_at       timestamptz not null default now(),
  kajabi_posted_at timestamptz,
  access_granted_at timestamptz,
  refunded_at      timestamptz
);
create index if not exists orders_status_idx on orders (status, created_at);
create index if not exists orders_parent_idx on orders (parent_id);

create table if not exists applications (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  lang        text,
  name        text,
  email       text,
  city        text,
  teach       text,
  program     text,
  why         text,
  dates       text,
  status      text not null default 'new'       -- new | good_fit | maybe | not_now | call_booked
);

-- Buyer data is private. Turn on row level security with NO policies:
-- the public (publishable/anon) key can read or write nothing here.
-- Only the server, through DATABASE_URL, can use these tables.
alter table orders enable row level security;
alter table applications enable row level security;
revoke all on orders, applications from anon, authenticated;
revoke all on sequence applications_id_seq from anon, authenticated;
