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

insert into arisan_country_status (country_code, status)
values
  ('MEX', 'alive'), ('RSA', 'alive'), ('KOR', 'alive'), ('CZE', 'alive'),
  ('CAN', 'alive'), ('BIH', 'alive'), ('QAT', 'alive'), ('SUI', 'alive'),
  ('BRA', 'alive'), ('MAR', 'alive'), ('HAI', 'alive'), ('SCO', 'alive'),
  ('USA', 'alive'), ('PAR', 'alive'), ('AUS', 'alive'), ('TUR', 'alive'),
  ('GER', 'alive'), ('CUW', 'alive'), ('CIV', 'alive'), ('ECU', 'alive'),
  ('NED', 'alive'), ('JPN', 'alive'), ('SWE', 'alive'), ('TUN', 'alive'),
  ('BEL', 'alive'), ('EGY', 'alive'), ('IRN', 'alive'), ('NZL', 'alive'),
  ('ESP', 'alive'), ('CPV', 'alive'), ('KSA', 'alive'), ('URU', 'alive'),
  ('FRA', 'alive'), ('SEN', 'alive'), ('IRQ', 'alive'), ('NOR', 'alive'),
  ('ARG', 'alive'), ('ALG', 'alive'), ('AUT', 'alive'), ('JOR', 'alive'),
  ('POR', 'alive'), ('COD', 'alive'), ('UZB', 'alive'), ('COL', 'alive'),
  ('ENG', 'alive'), ('CRO', 'alive'), ('GHA', 'alive'), ('PAN', 'alive')
on conflict (country_code) do nothing;

create or replace function arisan_mark_order_paid(p_order_id text)
returns table (participant_id uuid)
language plpgsql
security definer
as $$
declare
  v_order arisan_orders%rowtype;
  v_existing uuid;
  v_participant uuid;
  v_available_count integer;
  v_country text;
begin
  perform pg_advisory_xact_lock(hashtext('arisan-worldcup-draw'));

  select * into v_order
  from arisan_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order tidak ditemukan.';
  end if;

  select id into v_existing
  from arisan_participants
  where email = v_order.email;

  if v_existing is not null then
    update arisan_orders
      set status = 'paid', paid_at = coalesce(paid_at, now())
      where id = p_order_id;
    participant_id := v_existing;
    return next;
    return;
  end if;

  if (select count(*) from arisan_participants) >= 24 then
    raise exception 'Slot peserta sudah penuh.';
  end if;

  select count(*) into v_available_count
  from arisan_country_status status
  where not exists (
    select 1
    from arisan_country_assignments assignment
    where assignment.country_code = status.country_code
  );

  if v_available_count < 2 then
    raise exception 'Negara tersisa tidak cukup.';
  end if;

  insert into arisan_participants (name, email, order_id)
  values (v_order.name, v_order.email, v_order.id)
  returning id into v_participant;

  for v_country in
    select status.country_code
    from arisan_country_status status
    where not exists (
      select 1
      from arisan_country_assignments assignment
      where assignment.country_code = status.country_code
    )
    order by random()
    limit 2
  loop
    insert into arisan_country_assignments (participant_id, country_code)
    values (v_participant, v_country);
  end loop;

  update arisan_orders
    set status = 'paid', paid_at = now()
    where id = p_order_id;

  participant_id := v_participant;
  return next;
end;
$$;
