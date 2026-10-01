-- =====================================================================
-- SMARTBET — BOOKING CODES (share a bet slip with a short code)
-- =====================================================================
-- Run this AFTER the schema, the app-support file and (optionally) the seed.
-- Safe to re-run: no object from the platform schema is altered or dropped.
--
-- A booking code is a shareable snapshot of a bet slip. Whoever holds the code
-- can pull the same selections into their own slip, at their own stake.
--
--   booking_codes       one row per code (owner, stake, totals, expiry)
--   booking_code_legs   the selections in the slip (odds frozen at creation)
--
-- SECURITY MODEL — the code itself is the capability:
--   * creation  → create_booking_code(): authenticated only, re-reads every
--                 price from `selections`, never trusts the client.
--   * loading   → load_booking_code(): callable by anyone (anon included) with
--                 the exact code, so a shared slip works for logged-out
--                 visitors too. It is a SECURITY DEFINER function, which is why
--                 `booking_codes` needs no public SELECT policy — nobody can
--                 list or enumerate codes, only resolve one they already hold.
--   * owners can read and revoke their own codes (RLS policies below).
--   * nothing can be INSERTed directly by a client: there is no INSERT policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------
create table if not exists booking_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  user_id     uuid not null references profiles(id) on delete cascade,
  stake       numeric(20,0) check (stake is null or stake > 0),
  currency    char(3) not null default 'UGX' references currencies(code),
  leg_count   int not null default 0,
  total_odds  numeric(14,3) not null default 1,
  -- How many times the code has been pulled into someone's slip.
  load_count  int not null default 0,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now()
);

create table if not exists booking_code_legs (
  id              uuid primary key default gen_random_uuid(),
  booking_code_id uuid not null references booking_codes(id) on delete cascade,
  selection_id    uuid not null references selections(id) on delete cascade,
  -- Price at the moment the code was created; the live price is re-read on load.
  odds            numeric(10,3) not null,
  sort_order      int not null default 0,
  unique (booking_code_id, selection_id)
);

create index if not exists idx_booking_codes_user      on booking_codes (user_id, created_at desc);
create index if not exists idx_booking_codes_expiry    on booking_codes (expires_at);
create index if not exists idx_booking_code_legs_code  on booking_code_legs (booking_code_id);
create index if not exists idx_booking_code_legs_sel   on booking_code_legs (selection_id);

-- ---------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table booking_codes      enable row level security;
alter table booking_code_legs  enable row level security;

-- Owners see (and can revoke) their own codes. There is deliberately NO public
-- SELECT policy: a code is only resolvable through load_booking_code().
drop policy if exists "own booking codes" on booking_codes;
create policy "own booking codes" on booking_codes
  for select using (user_id = auth.uid());

drop policy if exists "own booking codes delete" on booking_codes;
create policy "own booking codes delete" on booking_codes
  for delete using (user_id = auth.uid());

drop policy if exists "own booking code legs" on booking_code_legs;
create policy "own booking code legs" on booking_code_legs
  for select using (
    exists (select 1 from booking_codes bc
            where bc.id = booking_code_legs.booking_code_id and bc.user_id = auth.uid())
  );

-- Table privileges. `anon` gets nothing at table level; the load function is
-- SECURITY DEFINER and runs as the owner, so it does not need a grant either.
revoke all on booking_codes, booking_code_legs from anon;
grant select, delete on booking_codes to authenticated;
grant select on booking_code_legs to authenticated;

-- ---------------------------------------------------------------------
-- 3. CODE ALLOCATION
-- ---------------------------------------------------------------------
-- 8 characters from a 32-symbol alphabet (I, O, 0 and 1 removed so a code can be
-- read out loud or typed from a screenshot): ~1.1e12 combinations.
create or replace function generate_booking_code() returns text
language plpgsql as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_i        int;
  v_tries    int := 0;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code
        || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from booking_codes where code = v_code);
    v_tries := v_tries + 1;
    if v_tries >= 25 then
      raise exception 'could not allocate a free booking code, please retry';
    end if;
  end loop;
  return v_code;
end $$;

-- ---------------------------------------------------------------------
-- 4. CREATE A CODE FROM THE CURRENT SLIP (signed-in users)
-- ---------------------------------------------------------------------
-- Mirrors the validation in place_bet(): every selection must exist, be active,
-- belong to an open market, and no accumulator may hold two selections from the
-- same event. Prices are re-read from the database, never taken from the client.
create or replace function create_booking_code(
  p_selection_ids uuid[],
  p_stake         numeric default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_count    int := coalesce(array_length(p_selection_ids, 1), 0);
  v_max_legs int;
  v_open     int;
  v_stake    numeric;
  v_total    numeric := 1;
  v_code     text;
  v_id       uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_count = 0 then raise exception 'no selections'; end if;

  select (value #>> '{}')::int into v_max_legs from app_settings where key = 'max_bet_legs';
  if v_count > coalesce(v_max_legs, 20) then raise exception 'too many legs'; end if;
  if v_count <> (select count(distinct x) from unnest(p_selection_ids) x) then
    raise exception 'duplicate selections';
  end if;

  select count(*) into v_open
  from selections s join markets m on m.id = s.market_id
  where s.id = any(p_selection_ids) and s.status = 'active' and m.status = 'open';
  if v_open <> v_count then raise exception 'selection is not available'; end if;

  if v_count > 1 and exists (
    select 1 from selections s join markets m on m.id = s.market_id
    where s.id = any(p_selection_ids)
    group by m.event_id having count(*) > 1
  ) then
    raise exception 'multiple selections from the same event are not allowed';
  end if;

  -- Simple abuse guard: cap the number of live codes one account can hold.
  if (select count(*) from booking_codes where user_id = v_user and expires_at > now()) >= 50 then
    raise exception 'too many active booking codes';
  end if;

  select coalesce(exp(sum(ln(s.odds))), 1) into v_total
  from selections s where s.id = any(p_selection_ids);

  v_stake := case when p_stake is null or p_stake <= 0 then null else trunc(p_stake) end;

  v_code := generate_booking_code();

  insert into booking_codes (code, user_id, stake, leg_count, total_odds)
  values (v_code, v_user, v_stake, v_count, round(v_total, 3))
  returning id into v_id;

  insert into booking_code_legs (booking_code_id, selection_id, odds, sort_order)
  select v_id, s.id, s.odds, row_number() over (order by m.event_id, s.id)
  from selections s join markets m on m.id = s.market_id
  where s.id = any(p_selection_ids);

  return v_code;
end $$;

-- ---------------------------------------------------------------------
-- 5. LOAD A CODE INTO A SLIP (anyone holding the code)
-- ---------------------------------------------------------------------
-- Returns one row per leg, with the CURRENT price, the price when the code was
-- created, and whether the leg is still bettable by place_bet()'s rules. An
-- unknown or expired code returns no rows.
--
-- Output column names become the JSON keys the web app reads, so every column
-- reference below is table-qualified (an unqualified name would resolve to the
-- RETURNS TABLE output variable instead of the column).
create or replace function load_booking_code(p_code text)
returns table (
  code             text,
  stake            numeric,
  total_odds       numeric,
  created_at       timestamptz,
  expires_at       timestamptz,
  leg_index        int,
  selection_id     uuid,
  selection_name   text,
  market_id        uuid,
  market_name      text,
  event_id         uuid,
  event_name       text,
  starts_at        timestamptz,
  odds             numeric,
  odds_at_creation numeric,
  is_available     boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_id   uuid;
begin
  if v_code = '' then return; end if;

  select bc.id into v_id
  from booking_codes bc
  where bc.code = v_code and bc.expires_at > now();

  if v_id is null then return; end if;

  update booking_codes set load_count = load_count + 1 where id = v_id;

  return query
  select bc.code, bc.stake, bc.total_odds, bc.created_at, bc.expires_at,
         l.sort_order,
         s.id, s.name,
         m.id, m.name,
         e.id, e.name,
         e.starts_at,
         s.odds, l.odds,
         (s.status = 'active'
          and m.status = 'open'
          and e.status in ('scheduled', 'live')
          and not (e.status = 'scheduled' and e.starts_at <= now() and not m.is_live))
  from booking_codes bc
  join booking_code_legs l on l.booking_code_id = bc.id
  join selections       s on s.id = l.selection_id
  join markets          m on m.id = s.market_id
  join events           e on e.id = m.event_id
  where bc.id = v_id
  order by l.sort_order;
end $$;

-- ---------------------------------------------------------------------
-- 6. PRIVILEGES
-- ---------------------------------------------------------------------
revoke all on function generate_booking_code() from public, anon, authenticated;

revoke all on function create_booking_code(uuid[], numeric) from public, anon;
grant execute on function create_booking_code(uuid[], numeric) to authenticated;

-- Sharing must work for logged-out visitors too.
revoke all on function load_booking_code(text) from public;
grant execute on function load_booking_code(text) to anon, authenticated;

-- =====================================================================
-- HOUSEKEEPING (optional, run whenever)
-- =====================================================================
-- If the app reports "function public.load_booking_code(text) does not exist"
-- right after running this file, PostgREST is holding a stale schema cache:
--   notify pgrst, 'reload schema';
--
-- Expired codes are ignored by load_booking_code(); delete them when you like:
--   delete from booking_codes where expires_at < now() - interval '30 days';
--
-- Most-shared slips:
--   select code, leg_count, total_odds, load_count, created_at
--   from booking_codes order by load_count desc limit 20;
-- =====================================================================
