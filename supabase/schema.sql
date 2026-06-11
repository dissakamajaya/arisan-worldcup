create table if not exists arisan_orders (
  id text primary key,
  name text not null,
  email text not null,
  amount integer not null,
  status text not null check (status in ('pending', 'paid', 'expired', 'failed')),
  payment_url text not null,
  provider text not null check (provider in ('simulated', 'doku')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create unique index if not exists arisan_orders_one_pending_email
  on arisan_orders (lower(email))
  where status = 'pending';

create table if not exists arisan_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  order_id text not null references arisan_orders(id),
  paid_at timestamptz not null default now()
);

create table if not exists arisan_country_assignments (
  participant_id uuid not null references arisan_participants(id) on delete cascade,
  country_code text not null,
  primary key (participant_id, country_code),
  unique (country_code)
);

create table if not exists arisan_country_status (
  country_code text primary key,
  status text not null check (status in ('alive', 'eliminated')) default 'alive',
  updated_at timestamptz not null default now()
);
