alter table arisan_country_assignments
  add column if not exists draw_bucket text not null default 'favorite';

alter table arisan_country_assignments
  drop constraint if exists arisan_country_assignments_draw_bucket_check;

alter table arisan_country_assignments
  add constraint arisan_country_assignments_draw_bucket_check
  check (draw_bucket in ('favorite', 'least_favorite'));

create table if not exists arisan_country_draw_buckets (
  country_code text primary key,
  draw_bucket text not null check (draw_bucket in ('favorite', 'least_favorite')),
  odds_rank integer not null unique check (odds_rank between 1 and 48),
  source text not null default 'market_odds_snapshot_2026_06_12',
  updated_at timestamptz not null default now()
);

insert into arisan_country_draw_buckets (country_code, draw_bucket, odds_rank, source)
values
  ('ESP', 'favorite', 1, 'market_odds_snapshot_2026_06_12'),
  ('FRA', 'favorite', 2, 'market_odds_snapshot_2026_06_12'),
  ('ENG', 'favorite', 3, 'market_odds_snapshot_2026_06_12'),
  ('POR', 'favorite', 4, 'market_odds_snapshot_2026_06_12'),
  ('BRA', 'favorite', 5, 'market_odds_snapshot_2026_06_12'),
  ('ARG', 'favorite', 6, 'market_odds_snapshot_2026_06_12'),
  ('GER', 'favorite', 7, 'market_odds_snapshot_2026_06_12'),
  ('NED', 'favorite', 8, 'market_odds_snapshot_2026_06_12'),
  ('BEL', 'favorite', 9, 'market_odds_snapshot_2026_06_12'),
  ('NOR', 'favorite', 10, 'market_odds_snapshot_2026_06_12'),
  ('URU', 'favorite', 11, 'market_odds_snapshot_2026_06_12'),
  ('USA', 'favorite', 12, 'market_odds_snapshot_2026_06_12'),
  ('MEX', 'favorite', 13, 'market_odds_snapshot_2026_06_12'),
  ('COL', 'favorite', 14, 'market_odds_snapshot_2026_06_12'),
  ('SUI', 'favorite', 15, 'market_odds_snapshot_2026_06_12'),
  ('MAR', 'favorite', 16, 'market_odds_snapshot_2026_06_12'),
  ('CRO', 'favorite', 17, 'market_odds_snapshot_2026_06_12'),
  ('JPN', 'favorite', 18, 'market_odds_snapshot_2026_06_12'),
  ('ECU', 'favorite', 19, 'market_odds_snapshot_2026_06_12'),
  ('TUR', 'favorite', 20, 'market_odds_snapshot_2026_06_12'),
  ('AUT', 'favorite', 21, 'market_odds_snapshot_2026_06_12'),
  ('SEN', 'favorite', 22, 'market_odds_snapshot_2026_06_12'),
  ('KOR', 'favorite', 23, 'market_odds_snapshot_2026_06_12'),
  ('CIV', 'favorite', 24, 'market_odds_snapshot_2026_06_12'),
  ('ALG', 'least_favorite', 25, 'market_odds_snapshot_2026_06_12'),
  ('EGY', 'least_favorite', 26, 'market_odds_snapshot_2026_06_12'),
  ('GHA', 'least_favorite', 27, 'market_odds_snapshot_2026_06_12'),
  ('SWE', 'least_favorite', 28, 'market_odds_snapshot_2026_06_12'),
  ('CAN', 'least_favorite', 29, 'market_odds_snapshot_2026_06_12'),
  ('SCO', 'least_favorite', 30, 'market_odds_snapshot_2026_06_12'),
  ('CZE', 'least_favorite', 31, 'market_odds_snapshot_2026_06_12'),
  ('AUS', 'least_favorite', 32, 'market_odds_snapshot_2026_06_12'),
  ('IRN', 'least_favorite', 33, 'market_odds_snapshot_2026_06_12'),
  ('PAR', 'least_favorite', 34, 'market_odds_snapshot_2026_06_12'),
  ('UZB', 'least_favorite', 35, 'market_odds_snapshot_2026_06_12'),
  ('PAN', 'least_favorite', 36, 'market_odds_snapshot_2026_06_12'),
  ('TUN', 'least_favorite', 37, 'market_odds_snapshot_2026_06_12'),
  ('KSA', 'least_favorite', 38, 'market_odds_snapshot_2026_06_12'),
  ('BIH', 'least_favorite', 39, 'market_odds_snapshot_2026_06_12'),
  ('COD', 'least_favorite', 40, 'market_odds_snapshot_2026_06_12'),
  ('RSA', 'least_favorite', 41, 'market_odds_snapshot_2026_06_12'),
  ('IRQ', 'least_favorite', 42, 'market_odds_snapshot_2026_06_12'),
  ('JOR', 'least_favorite', 43, 'market_odds_snapshot_2026_06_12'),
  ('CPV', 'least_favorite', 44, 'market_odds_snapshot_2026_06_12'),
  ('QAT', 'least_favorite', 45, 'market_odds_snapshot_2026_06_12'),
  ('NZL', 'least_favorite', 46, 'market_odds_snapshot_2026_06_12'),
  ('CUW', 'least_favorite', 47, 'market_odds_snapshot_2026_06_12'),
  ('HAI', 'least_favorite', 48, 'market_odds_snapshot_2026_06_12')
on conflict (country_code) do update
  set draw_bucket = excluded.draw_bucket,
      odds_rank = excluded.odds_rank,
      source = excluded.source,
      updated_at = now();

create table if not exists arisan_match_results (
  match_label text primary key,
  status text not null check (status in ('scheduled', 'live', 'finished')),
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  updated_at timestamptz not null default now(),
  check (
    (status = 'scheduled' and home_score is null and away_score is null)
    or (status in ('live', 'finished') and home_score is not null and away_score is not null)
  )
);

insert into arisan_match_results (match_label, status, home_score, away_score)
values
  ('Mexico vs South Africa', 'finished', 2, 0),
  ('Korea Republic vs Czechia', 'finished', 2, 1)
on conflict (match_label) do update
  set status = excluded.status,
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      updated_at = now();

create or replace function arisan_mark_order_paid(p_order_id text)
returns table (participant_id uuid)
language plpgsql
security definer
as $$
declare
  v_order arisan_orders%rowtype;
  v_existing uuid;
  v_participant uuid;
  v_available_favorite_count integer;
  v_available_least_count integer;
  v_country text;
  v_bucket text;
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

  select count(*) into v_available_favorite_count
  from arisan_country_draw_buckets bucket
  where bucket.draw_bucket = 'favorite'
  and not exists (
    select 1
    from arisan_country_assignments assignment
    where assignment.country_code = bucket.country_code
  );

  select count(*) into v_available_least_count
  from arisan_country_draw_buckets bucket
  where bucket.draw_bucket = 'least_favorite'
  and not exists (
    select 1
    from arisan_country_assignments assignment
    where assignment.country_code = bucket.country_code
  );

  if v_available_favorite_count < 1 or v_available_least_count < 1 then
    raise exception 'Negara tersisa tidak cukup.';
  end if;

  insert into arisan_participants (name, email, order_id)
  values (v_order.name, v_order.email, v_order.id)
  returning id into v_participant;

  for v_country, v_bucket in
    (
      select bucket.country_code, bucket.draw_bucket
      from arisan_country_draw_buckets bucket
      where bucket.draw_bucket = 'favorite'
      and not exists (
        select 1
        from arisan_country_assignments assignment
        where assignment.country_code = bucket.country_code
      )
      order by random()
      limit 1
    )
    union all
    (
      select bucket.country_code, bucket.draw_bucket
      from arisan_country_draw_buckets bucket
      where bucket.draw_bucket = 'least_favorite'
      and not exists (
        select 1
        from arisan_country_assignments assignment
        where assignment.country_code = bucket.country_code
      )
      order by random()
      limit 1
    )
  loop
    insert into arisan_country_assignments (participant_id, country_code, draw_bucket)
    values (v_participant, v_country, v_bucket);
  end loop;

  update arisan_orders
    set status = 'paid', paid_at = now()
    where id = p_order_id;

  participant_id := v_participant;
  return next;
end;
$$;

create or replace function arisan_redraw_all_assignments()
returns table (participant_id uuid, country_code text, draw_bucket text)
language plpgsql
security definer
as $$
declare
  v_participant arisan_participants%rowtype;
  v_country text;
  v_bucket text;
begin
  perform pg_advisory_xact_lock(hashtext('arisan-worldcup-draw'));

  delete from arisan_country_assignments;

  for v_participant in
    select *
    from arisan_participants
    order by paid_at, id
  loop
    for v_country, v_bucket in
      (
        select bucket.country_code, bucket.draw_bucket
        from arisan_country_draw_buckets bucket
        where bucket.draw_bucket = 'favorite'
        and not exists (
          select 1
          from arisan_country_assignments assignment
          where assignment.country_code = bucket.country_code
        )
        order by random()
        limit 1
      )
      union all
      (
        select bucket.country_code, bucket.draw_bucket
        from arisan_country_draw_buckets bucket
        where bucket.draw_bucket = 'least_favorite'
        and not exists (
          select 1
          from arisan_country_assignments assignment
          where assignment.country_code = bucket.country_code
        )
        order by random()
        limit 1
      )
    loop
      insert into arisan_country_assignments (participant_id, country_code, draw_bucket)
      values (v_participant.id, v_country, v_bucket);
    end loop;
  end loop;

  return query
    select assignment.participant_id, assignment.country_code, assignment.draw_bucket
    from arisan_country_assignments assignment
    order by assignment.participant_id, assignment.draw_bucket;
end;
$$;

select arisan_redraw_all_assignments();
