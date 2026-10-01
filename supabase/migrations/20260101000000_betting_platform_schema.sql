-- =====================================================================
-- BETTING PLATFORM SCHEMA  (PostgreSQL / Supabase)  -- UGX ONLY
-- All money is in Ugandan Shillings (UGX, whole shillings, no decimals).
-- Run in the Supabase SQL Editor. Sections:
--   0. Extensions & enums
--   1. Users / KYC / responsible gambling
--   2. Wallets & LEDGER (append-only)
--   3. Payments (deposits / withdrawals)
--   4. Sportsbook catalogue (sports, events, markets, selections)
--   5. Bets & bet legs
--   6. Bonuses & promotions
--   7. Ops (audit, notifications, settings)
--   8. Functions (ledger posting, place bet, settle, deposits, withdrawals)
--   9. Triggers
--  10. Indexes
--  11. Row Level Security
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS & ENUMS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";

create type user_role          as enum ('user', 'support', 'trader', 'admin');
create type account_status     as enum ('active', 'suspended', 'self_excluded', 'closed');
create type kyc_status         as enum ('none', 'pending', 'verified', 'rejected');
create type kyc_doc_type       as enum ('passport', 'national_id', 'drivers_license', 'proof_of_address', 'selfie', 'other');
create type ledger_tx_type     as enum (
  'deposit', 'withdrawal', 'withdrawal_reversal',
  'bet_stake', 'bet_win', 'bet_refund', 'bet_cashout',
  'bonus_credit', 'bonus_reversal',
  'fee', 'adjustment', 'chargeback'
);
create type payment_status     as enum ('pending', 'processing', 'completed', 'failed', 'cancelled', 'rejected');
create type payment_method_type as enum ('card', 'bank_transfer', 'mobile_money', 'e_wallet');
create type event_status       as enum ('scheduled', 'live', 'finished', 'postponed', 'cancelled', 'abandoned');
create type market_status      as enum ('open', 'suspended', 'closed', 'settled', 'void');
create type selection_status   as enum ('active', 'suspended', 'won', 'lost', 'void');
create type bet_type           as enum ('single', 'accumulator');
create type bet_status         as enum ('pending', 'won', 'lost', 'void', 'cashed_out', 'cancelled');
create type leg_status         as enum ('pending', 'won', 'lost', 'void');
create type bonus_type         as enum ('deposit_match', 'free_bet', 'cashback', 'no_deposit');
create type user_bonus_status  as enum ('active', 'completed', 'expired', 'forfeited');
create type limit_type         as enum ('deposit_daily', 'deposit_weekly', 'deposit_monthly', 'loss_daily', 'loss_weekly', 'loss_monthly', 'stake_single');
create type notification_type  as enum ('system', 'bet', 'payment', 'promo', 'kyc', 'security');

-- Generic updated_at trigger function
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. USERS, KYC, RESPONSIBLE GAMBLING
-- ---------------------------------------------------------------------
-- Currency reference table (UGX only) - must exist before tables that reference it
create table currencies (
  code        char(3) primary key,            -- ISO 4217
  name        text not null,
  symbol      text,
  decimals    smallint not null default 0,
  is_active   boolean not null default true
);

insert into currencies (code, name, symbol, decimals) values
  ('UGX','Ugandan Shilling','USh',0)
on conflict do nothing;

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        citext unique,
  email           citext,
  phone           text,
  first_name      text,
  last_name       text,
  date_of_birth   date,
  country_code    char(2),
  city            text,
  address_line    text,
  odds_format     text not null default 'decimal' check (odds_format in ('decimal','fractional','american')),
  language        text not null default 'en',
  role            user_role not null default 'user',
  status          account_status not null default 'active',
  kyc_status      kyc_status not null default 'none',
  referral_code   text unique default substr(md5(random()::text), 1, 8),
  referred_by     uuid references profiles(id),
  marketing_opt_in boolean not null default false,
  terms_accepted_at timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table kyc_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  doc_type      kyc_doc_type not null,
  storage_path  text not null,                 -- Supabase Storage path
  status        kyc_status not null default 'pending',
  rejection_reason text,
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table user_limits (                     -- responsible gambling limits
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  limit_type  limit_type not null,
  currency    char(3) not null default 'UGX' references currencies(code),
  amount      numeric(20,0) not null check (amount > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, limit_type, currency)
);

create table self_exclusions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  reason      text,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,                     -- null = permanent
  created_at  timestamptz not null default now()
);

create table user_sessions (                   -- login / device tracking for fraud
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  ip_address  inet,
  user_agent  text,
  device_id   text,
  country_code char(2),
  created_at  timestamptz not null default now()
);

create table referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references profiles(id),
  referred_id   uuid not null unique references profiles(id),
  reward_paid   boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. CURRENCIES, WALLETS, LEDGER
-- ---------------------------------------------------------------------

create table wallets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  currency    char(3) not null default 'UGX' references currencies(code),
  balance     numeric(20,0) not null default 0 check (balance >= 0),
  is_locked   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, currency)
);

-- Append-only double-entry-style journal. balance_before/after snapshot the wallet.
-- amount is SIGNED: positive = credit to player, negative = debit from player.
create table ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id),
  wallet_id        uuid not null references wallets(id),
  transaction_type ledger_tx_type not null,
  amount           numeric(20,0) not null check (amount <> 0),
  currency         char(3) not null default 'UGX' references currencies(code),
  reference_id     uuid,                       -- bet_id / deposit_id / withdrawal_id / user_bonus_id ...
  reference_type   text,                       -- 'bet' | 'deposit' | 'withdrawal' | 'bonus' | 'manual'
  balance_before   numeric(20,0) not null,
  balance_after    numeric(20,0) not null,
  idempotency_key  text unique,                -- prevents double posting on retries
  description      text,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  constraint ledger_balance_math check (balance_after = balance_before + amount),
  constraint ledger_balance_nonneg check (balance_after >= 0)
);

-- Ledger is immutable
create or replace function ledger_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only';
end $$;

create trigger trg_ledger_no_update before update or delete on ledger_entries
  for each row execute function ledger_block_mutation();
create trigger trg_ledger_no_truncate before truncate on ledger_entries
  for each statement execute function ledger_block_mutation();

-- ---------------------------------------------------------------------
-- 3. PAYMENTS
-- ---------------------------------------------------------------------
create table payment_methods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  method_type   payment_method_type not null,
  provider      text not null,                 -- 'stripe', 'flutterwave', 'mtn_momo', 'airtel', ...
  provider_token text,                         -- tokenised ref only, NEVER raw card data
  label         text,                          -- e.g. 'Visa •••• 4242', '+256 7** *** 123'
  is_default    boolean not null default false,
  is_verified   boolean not null default false,
  created_at    timestamptz not null default now()
);

create table deposits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id),
  wallet_id          uuid not null references wallets(id),
  payment_method_id  uuid references payment_methods(id),
  provider           text not null,
  provider_reference text,                     -- PSP transaction id
  amount             numeric(20,0) not null check (amount > 0),
  fee                numeric(20,0) not null default 0 check (fee >= 0),
  currency           char(3) not null default 'UGX' references currencies(code),
  status             payment_status not null default 'pending',
  failure_reason     text,
  ip_address         inet,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz,
  unique (provider, provider_reference)
);

create table withdrawals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id),
  wallet_id          uuid not null references wallets(id),
  payment_method_id  uuid references payment_methods(id),
  provider           text,
  provider_reference text,
  amount             numeric(20,0) not null check (amount > 0),
  fee                numeric(20,0) not null default 0 check (fee >= 0),
  currency           char(3) not null default 'UGX' references currencies(code),
  status             payment_status not null default 'pending',
  destination        text,                     -- masked account / phone / wallet address
  rejection_reason   text,
  reviewed_by        uuid references profiles(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);

-- ---------------------------------------------------------------------
-- 4. SPORTSBOOK CATALOGUE
-- ---------------------------------------------------------------------
create table sports (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  icon        text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

create table leagues (                          -- competitions / tournaments
  id          uuid primary key default gen_random_uuid(),
  sport_id    uuid not null references sports(id) on delete cascade,
  name        text not null,
  slug        text not null,
  country_code char(2),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  unique (sport_id, slug)
);

create table teams (                            -- teams or players (tennis, boxing, etc.)
  id          uuid primary key default gen_random_uuid(),
  sport_id    uuid not null references sports(id) on delete cascade,
  name        text not null,
  short_name  text,
  logo_url    text,
  country_code char(2),
  unique (sport_id, name)
);

create table events (                           -- fixtures / matches
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references leagues(id),
  home_team_id  uuid references teams(id),
  away_team_id  uuid references teams(id),
  name          text not null,                  -- 'Arsenal vs Chelsea'
  starts_at     timestamptz not null,
  status        event_status not null default 'scheduled',
  home_score    int,
  away_score    int,
  result_data   jsonb not null default '{}',    -- period scores, stats, etc.
  external_id   text,                           -- odds/data feed id
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (external_id)
);

create table market_types (                     -- templates: 1X2, Over/Under, BTTS, Handicap...
  id          uuid primary key default gen_random_uuid(),
  sport_id    uuid references sports(id),
  code        text not null unique,             -- 'MATCH_WINNER', 'OVER_UNDER'
  name        text not null,
  description text
);

create table markets (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  market_type_id uuid not null references market_types(id),
  name           text not null,
  line           numeric(8,2),                  -- e.g. 2.5 goals, -1.5 handicap
  status         market_status not null default 'open',
  is_live        boolean not null default false,
  closes_at      timestamptz,
  settled_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table selections (                       -- the outcomes users bet on
  id          uuid primary key default gen_random_uuid(),
  market_id   uuid not null references markets(id) on delete cascade,
  name        text not null,                    -- 'Home', 'Draw', 'Over 2.5'
  odds        numeric(10,3) not null check (odds >= 1.001),   -- decimal odds
  status      selection_status not null default 'active',
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

create table odds_history (
  id            bigint generated always as identity primary key,
  selection_id  uuid not null references selections(id) on delete cascade,
  odds          numeric(10,3) not null,
  recorded_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. BETS
-- ---------------------------------------------------------------------
create table bets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id),
  wallet_id        uuid not null references wallets(id),
  bet_type         bet_type not null,
  stake            numeric(20,0) not null check (stake > 0),
  currency         char(3) not null default 'UGX' references currencies(code),
  total_odds       numeric(14,3) not null check (total_odds >= 1),
  potential_payout numeric(20,0) not null,
  payout           numeric(20,0) not null default 0,
  status           bet_status not null default 'pending',
  user_bonus_id    uuid,                        -- FK added after user_bonuses is created
  is_free_bet      boolean not null default false,
  cashout_amount   numeric(20,0),
  ip_address       inet,
  placed_at        timestamptz not null default now(),
  settled_at       timestamptz
);

create table bet_legs (
  id                 uuid primary key default gen_random_uuid(),
  bet_id             uuid not null references bets(id) on delete cascade,
  event_id           uuid not null references events(id),
  market_id          uuid not null references markets(id),
  selection_id       uuid not null references selections(id),
  odds_at_placement  numeric(10,3) not null,
  status             leg_status not null default 'pending',
  settled_at         timestamptz,
  unique (bet_id, selection_id)
);

-- ---------------------------------------------------------------------
-- 6. BONUSES & PROMOTIONS
-- ---------------------------------------------------------------------
create table promotions (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,               -- promo code (optional)
  name                text not null,
  description         text,
  bonus_type          bonus_type not null,
  match_percent       numeric(6,2),              -- e.g. 100 = 100% deposit match
  max_bonus_amount    numeric(20,0),
  fixed_amount        numeric(20,0),             -- free bet / no-deposit amount
  min_deposit         numeric(20,0),
  wagering_multiplier numeric(6,2) not null default 1,
  min_odds            numeric(6,2),
  currency            char(3) default 'UGX' references currencies(code),
  starts_at           timestamptz not null default now(),
  ends_at             timestamptz,
  max_redemptions     int,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

create table user_bonuses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  promotion_id       uuid not null references promotions(id),
  amount             numeric(20,0) not null check (amount >= 0),
  currency           char(3) not null default 'UGX' references currencies(code),
  wagering_required  numeric(20,0) not null default 0,
  wagering_progress  numeric(20,0) not null default 0,
  status             user_bonus_status not null default 'active',
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);

alter table bets
  add constraint bets_user_bonus_fk foreign key (user_bonus_id) references user_bonuses(id);

-- ---------------------------------------------------------------------
-- 7. OPS: AUDIT, NOTIFICATIONS, SETTINGS
-- ---------------------------------------------------------------------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        notification_type not null default 'system',
  title       text not null,
  body        text,
  data        jsonb not null default '{}',
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references profiles(id),
  action      text not null,                    -- 'odds.update', 'withdrawal.approve', ...
  entity_type text,
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create table app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into app_settings (key, value, description) values
  ('min_stake',        '500',       'Minimum stake per bet (UGX)'),
  ('max_stake',        '5000000',   'Maximum stake per bet (UGX)'),
  ('max_bet_legs',     '20',        'Maximum legs in an accumulator'),
  ('min_withdrawal',   '5000',      'Minimum withdrawal amount (UGX)')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 8. FUNCTIONS
-- ---------------------------------------------------------------------

-- 8.1 Core ledger poster: locks wallet, updates balance, writes ledger row atomically.
-- p_amount is signed (+credit / -debit). Idempotent on p_idempotency_key.
create or replace function post_ledger_entry(
  p_wallet_id       uuid,
  p_tx_type         ledger_tx_type,
  p_amount          numeric,
  p_reference_id    uuid default null,
  p_reference_type  text default null,
  p_idempotency_key text default null,
  p_description     text default null,
  p_metadata        jsonb default '{}'
) returns ledger_entries
language plpgsql security definer set search_path = public as $$
declare
  w   wallets%rowtype;
  existing ledger_entries%rowtype;
  entry ledger_entries%rowtype;
begin
  if p_idempotency_key is not null then
    select * into existing from ledger_entries where idempotency_key = p_idempotency_key;
    if found then return existing; end if;
  end if;

  select * into w from wallets where id = p_wallet_id for update;
  if not found then raise exception 'wallet % not found', p_wallet_id; end if;
  if w.is_locked then raise exception 'wallet is locked'; end if;
  if w.balance + p_amount < 0 then raise exception 'insufficient funds'; end if;

  update wallets set balance = balance + p_amount, updated_at = now() where id = w.id;

  insert into ledger_entries (
    user_id, wallet_id, transaction_type, amount, currency, reference_id, reference_type,
    balance_before, balance_after, idempotency_key, description, metadata
  ) values (
    w.user_id, w.id, p_tx_type, p_amount, w.currency, p_reference_id, p_reference_type,
    w.balance, w.balance + p_amount, p_idempotency_key, p_description, p_metadata
  ) returning * into entry;

  return entry;
end $$;

-- 8.2 Place a bet (called by the logged-in user via supabase.rpc('place_bet', ...))
-- Odds are read from the DB at placement time (never trusted from the client).
create or replace function place_bet(
  p_stake         numeric,
  p_selection_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_profile  profiles%rowtype;
  v_wallet   wallets%rowtype;
  v_bet_id   uuid;
  v_total    numeric := 1;
  v_count    int := coalesce(array_length(p_selection_ids, 1), 0);
  v_max_legs int;
  v_min_stake numeric;
  v_max_stake numeric;
  r          record;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_stake is null or p_stake <= 0 or p_stake <> trunc(p_stake) then
    raise exception 'stake must be a whole number of UGX';
  end if;
  select (value #>> '{}')::numeric into v_min_stake from app_settings where key = 'min_stake';
  select (value #>> '{}')::numeric into v_max_stake from app_settings where key = 'max_stake';
  if p_stake < coalesce(v_min_stake, 0) then raise exception 'stake below minimum'; end if;
  if p_stake > coalesce(v_max_stake, p_stake) then raise exception 'stake above maximum'; end if;
  if v_count = 0 then raise exception 'no selections'; end if;

  select (value #>> '{}')::int into v_max_legs from app_settings where key = 'max_bet_legs';
  if v_count > coalesce(v_max_legs, 20) then raise exception 'too many legs'; end if;
  if v_count <> (select count(distinct x) from unnest(p_selection_ids) x) then
    raise exception 'duplicate selections';
  end if;

  select * into v_profile from profiles where id = v_user;
  if v_profile.status <> 'active' then raise exception 'account not active'; end if;
  if v_profile.kyc_status = 'rejected' then raise exception 'kyc rejected'; end if;
  if exists (select 1 from self_exclusions
             where user_id = v_user and starts_at <= now() and (ends_at is null or ends_at > now())) then
    raise exception 'self-excluded';
  end if;

  select * into v_wallet from wallets where user_id = v_user and currency = 'UGX';
  if not found then raise exception 'wallet not found'; end if;

  -- per-bet stake limit
  if exists (select 1 from user_limits
             where user_id = v_user and limit_type = 'stake_single'
               and is_active and p_stake > amount) then
    raise exception 'stake exceeds your limit';
  end if;

  -- validate every selection, multiply odds
  for r in
    select s.id as sel_id, s.odds, s.status as sel_status,
           m.id as market_id, m.status as mkt_status,
           e.id as event_id, e.status as evt_status, e.starts_at, m.is_live
    from selections s
    join markets m on m.id = s.market_id
    join events  e on e.id = m.event_id
    where s.id = any(p_selection_ids)
  loop
    if r.sel_status <> 'active' or r.mkt_status <> 'open'
       or r.evt_status not in ('scheduled','live')
       or (r.evt_status = 'scheduled' and r.starts_at <= now() and not r.is_live) then
      raise exception 'selection % is not available', r.sel_id;
    end if;
    v_total := v_total * r.odds;
  end loop;

  if (select count(*) from selections where id = any(p_selection_ids)) <> v_count then
    raise exception 'unknown selection';
  end if;

  -- one accumulator cannot contain two selections of the same event
  if exists (
    select 1 from selections s join markets m on m.id = s.market_id
    where s.id = any(p_selection_ids)
    group by m.event_id having count(*) > 1
  ) and v_count > 1 then
    raise exception 'multiple selections from the same event are not allowed';
  end if;

  insert into bets (user_id, wallet_id, bet_type, stake, currency, total_odds, potential_payout)
  values (v_user, v_wallet.id,
          case when v_count = 1 then 'single'::bet_type else 'accumulator'::bet_type end,
          p_stake, 'UGX', round(v_total, 3), round(p_stake * v_total, 0))
  returning id into v_bet_id;

  insert into bet_legs (bet_id, event_id, market_id, selection_id, odds_at_placement)
  select v_bet_id, m.event_id, m.id, s.id, s.odds
  from selections s join markets m on m.id = s.market_id
  where s.id = any(p_selection_ids);

  -- debit stake via ledger (raises 'insufficient funds' if needed)
  perform post_ledger_entry(v_wallet.id, 'bet_stake', -p_stake, v_bet_id, 'bet',
                            'bet_stake:' || v_bet_id, 'Bet stake');

  return v_bet_id;
end $$;

-- 8.3 Settle a single bet based on its leg results. Service role / admin only.
create or replace function settle_bet(p_bet_id uuid) returns bet_status
language plpgsql security definer set search_path = public as $$
declare
  b        bets%rowtype;
  v_pending int; v_lost int; v_won int; v_void int;
  v_odds   numeric;
  v_payout numeric;
begin
  select * into b from bets where id = p_bet_id for update;
  if not found then raise exception 'bet not found'; end if;
  if b.status <> 'pending' then return b.status; end if;

  select count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'lost'),
         count(*) filter (where status = 'won'),
         count(*) filter (where status = 'void')
    into v_pending, v_lost, v_won, v_void
  from bet_legs where bet_id = p_bet_id;

  if v_lost > 0 then
    update bets set status = 'lost', payout = 0, settled_at = now() where id = p_bet_id;
    return 'lost';
  end if;

  if v_pending > 0 then return 'pending'; end if;

  if v_won = 0 then   -- every leg void: refund stake
    perform post_ledger_entry(b.wallet_id, 'bet_refund', b.stake, b.id, 'bet',
                              'bet_refund:' || b.id, 'Bet voided');
    update bets set status = 'void', payout = b.stake, settled_at = now() where id = p_bet_id;
    return 'void';
  end if;

  -- won: void legs count as odds 1.0
  select coalesce(exp(sum(ln(odds_at_placement))), 1) into v_odds
  from bet_legs where bet_id = p_bet_id and status = 'won';

  v_payout := round(b.stake * v_odds, 0);
  perform post_ledger_entry(b.wallet_id, 'bet_win', v_payout, b.id, 'bet',
                            'bet_win:' || b.id, 'Bet won');
  update bets set status = 'won', payout = v_payout, settled_at = now() where id = p_bet_id;
  return 'won';
end $$;

-- 8.4 Settle a market: mark selection results, update legs, settle all affected bets.
create or replace function settle_market(
  p_market_id       uuid,
  p_winning_ids     uuid[],
  p_void_ids        uuid[] default '{}'
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_bet uuid;
  v_n   int := 0;
begin
  update selections set status = case
      when id = any(p_void_ids)    then 'void'::selection_status
      when id = any(p_winning_ids) then 'won'::selection_status
      else 'lost'::selection_status end
  where market_id = p_market_id;

  update bet_legs bl set status = case s.status
        when 'won'  then 'won'::leg_status
        when 'lost' then 'lost'::leg_status
        else 'void'::leg_status end,
      settled_at = now()
  from selections s
  where s.id = bl.selection_id and bl.market_id = p_market_id and bl.status = 'pending';

  update markets set status = 'settled', settled_at = now() where id = p_market_id;

  for v_bet in select distinct bet_id from bet_legs where market_id = p_market_id loop
    perform settle_bet(v_bet);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- 8.5 Complete a deposit (called from your payment webhook using the service role)
create or replace function complete_deposit(p_deposit_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d deposits%rowtype;
begin
  select * into d from deposits where id = p_deposit_id for update;
  if not found then raise exception 'deposit not found'; end if;
  if d.status = 'completed' then return; end if;

  perform post_ledger_entry(d.wallet_id, 'deposit', d.amount - d.fee, d.id, 'deposit',
                            'deposit:' || d.id, 'Deposit via ' || d.provider);
  update deposits set status = 'completed', completed_at = now() where id = d.id;
end $$;

-- 8.6 Request a withdrawal (user) - funds are debited immediately, reversed if rejected
create or replace function request_withdrawal(
  p_amount numeric, p_payment_method_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_wallet wallets%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'amount must be a whole number of UGX';
  end if;
  if p_amount < coalesce((select (value #>> '{}')::numeric from app_settings where key = 'min_withdrawal'), 0) then
    raise exception 'below minimum withdrawal';
  end if;
  if (select kyc_status from profiles where id = v_user) <> 'verified' then
    raise exception 'KYC verification required before withdrawing';
  end if;

  select * into v_wallet from wallets where user_id = v_user and currency = 'UGX';
  if not found then raise exception 'wallet not found'; end if;

  insert into withdrawals (user_id, wallet_id, payment_method_id, amount, currency)
  values (v_user, v_wallet.id, p_payment_method_id, p_amount, 'UGX')
  returning id into v_id;

  perform post_ledger_entry(v_wallet.id, 'withdrawal', -p_amount, v_id, 'withdrawal',
                            'withdrawal:' || v_id, 'Withdrawal request');
  return v_id;
end $$;

-- 8.7 Reject a withdrawal and refund the wallet (admin / service role)
create or replace function reject_withdrawal(p_withdrawal_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare w withdrawals%rowtype;
begin
  select * into w from withdrawals where id = p_withdrawal_id for update;
  if not found then raise exception 'withdrawal not found'; end if;
  if w.status not in ('pending','processing') then raise exception 'withdrawal already finalised'; end if;

  perform post_ledger_entry(w.wallet_id, 'withdrawal_reversal', w.amount, w.id, 'withdrawal',
                            'withdrawal_reversal:' || w.id, p_reason);
  update withdrawals set status = 'rejected', rejection_reason = p_reason,
         reviewed_at = now(), reviewed_by = auth.uid() where id = w.id;
end $$;

-- Lock down money-moving functions: only the service role may call them directly.
revoke all on function post_ledger_entry(uuid, ledger_tx_type, numeric, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function settle_bet(uuid)              from public, anon, authenticated;
revoke all on function settle_market(uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function complete_deposit(uuid)        from public, anon, authenticated;
revoke all on function reject_withdrawal(uuid, text) from public, anon, authenticated;
-- User-callable RPCs
revoke all on function place_bet(numeric, uuid[])                 from public, anon;
revoke all on function request_withdrawal(numeric, uuid)          from public, anon;
grant execute on function place_bet(numeric, uuid[])              to authenticated;
grant execute on function request_withdrawal(numeric, uuid)       to authenticated;

-- ---------------------------------------------------------------------
-- 9. TRIGGERS
-- ---------------------------------------------------------------------
-- updated_at
create trigger trg_profiles_upd  before update on profiles  for each row execute function set_updated_at();
create trigger trg_wallets_upd   before update on wallets   for each row execute function set_updated_at();
create trigger trg_events_upd    before update on events    for each row execute function set_updated_at();
create trigger trg_markets_upd   before update on markets   for each row execute function set_updated_at();
create trigger trg_limits_upd    before update on user_limits for each row execute function set_updated_at();
create trigger trg_selections_upd before update on selections for each row execute function set_updated_at();

-- Log odds changes
create or replace function log_odds_change() returns trigger
language plpgsql as $$
begin
  if new.odds is distinct from old.odds then
    insert into odds_history (selection_id, odds) values (new.id, new.odds);
  end if;
  return new;
end $$;
create trigger trg_selection_odds after update on selections
  for each row execute function log_odds_change();

-- Auto-create profile + default wallet when a Supabase auth user signs up
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, username)
  values (new.id, new.email, new.raw_user_meta_data ->> 'username');

  insert into wallets (user_id, currency) values (new.id, 'UGX');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Prevent users from escalating their own role / status / kyc via the API
create or replace function protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    new.role       := old.role;
    new.status     := old.status;
    new.kyc_status := old.kyc_status;
  end if;
  return new;
end $$;
create trigger trg_protect_profile before update on profiles
  for each row execute function protect_profile_fields();

-- ---------------------------------------------------------------------
-- 10. INDEXES
-- ---------------------------------------------------------------------
create index idx_ledger_user_created     on ledger_entries (user_id, created_at desc);
create index idx_ledger_wallet_created   on ledger_entries (wallet_id, created_at desc);
create index idx_ledger_reference        on ledger_entries (reference_type, reference_id);
create index idx_ledger_type             on ledger_entries (transaction_type);

create index idx_wallets_user            on wallets (user_id);
create index idx_deposits_user           on deposits (user_id, created_at desc);
create index idx_deposits_status         on deposits (status);
create index idx_withdrawals_user        on withdrawals (user_id, created_at desc);
create index idx_withdrawals_status      on withdrawals (status);
create index idx_kyc_user                on kyc_documents (user_id);
create index idx_sessions_user           on user_sessions (user_id, created_at desc);

create index idx_leagues_sport           on leagues (sport_id);
create index idx_events_league_start     on events (league_id, starts_at);
create index idx_events_status_start     on events (status, starts_at);
create index idx_markets_event           on markets (event_id);
create index idx_selections_market       on selections (market_id);
create index idx_odds_history_sel        on odds_history (selection_id, recorded_at desc);

create index idx_bets_user_placed        on bets (user_id, placed_at desc);
create index idx_bets_status             on bets (status) where status = 'pending';
create index idx_bet_legs_bet            on bet_legs (bet_id);
create index idx_bet_legs_market_pending on bet_legs (market_id) where status = 'pending';
create index idx_bet_legs_selection      on bet_legs (selection_id);

create index idx_user_bonuses_user       on user_bonuses (user_id, status);
create index idx_notifications_user      on notifications (user_id, is_read, created_at desc);
create index idx_audit_entity            on audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY
-- Rule of thumb: users can READ their own rows; all money/bet writes go through
-- the SECURITY DEFINER functions above (or the service role), never direct writes.
-- ---------------------------------------------------------------------
alter table profiles        enable row level security;
alter table kyc_documents   enable row level security;
alter table user_limits     enable row level security;
alter table self_exclusions enable row level security;
alter table user_sessions   enable row level security;
alter table referrals       enable row level security;
alter table wallets         enable row level security;
alter table ledger_entries  enable row level security;
alter table payment_methods enable row level security;
alter table deposits        enable row level security;
alter table withdrawals     enable row level security;
alter table bets            enable row level security;
alter table bet_legs        enable row level security;
alter table user_bonuses    enable row level security;
alter table notifications   enable row level security;
alter table audit_logs      enable row level security;
alter table app_settings    enable row level security;
alter table currencies      enable row level security;
alter table sports          enable row level security;
alter table leagues         enable row level security;
alter table teams           enable row level security;
alter table events          enable row level security;
alter table market_types    enable row level security;
alter table markets         enable row level security;
alter table selections      enable row level security;
alter table odds_history    enable row level security;
alter table promotions      enable row level security;

-- helper: is the caller staff?
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','support','trader'));
$$;

-- Own-row read policies
create policy "own profile read"   on profiles        for select using (id = auth.uid() or is_staff());
create policy "own profile update" on profiles        for update using (id = auth.uid()) with check (id = auth.uid());
create policy "own kyc read"       on kyc_documents   for select using (user_id = auth.uid() or is_staff());
create policy "own kyc insert"     on kyc_documents   for insert with check (user_id = auth.uid());
create policy "own limits read"    on user_limits     for select using (user_id = auth.uid() or is_staff());
create policy "own limits write"   on user_limits     for insert with check (user_id = auth.uid());
create policy "own limits update"  on user_limits     for update using (user_id = auth.uid());
create policy "own exclusions"     on self_exclusions for select using (user_id = auth.uid() or is_staff());
create policy "self exclude"       on self_exclusions for insert with check (user_id = auth.uid());
create policy "own sessions"       on user_sessions   for select using (user_id = auth.uid() or is_staff());
create policy "own referrals"      on referrals       for select using (referrer_id = auth.uid() or referred_id = auth.uid());
create policy "own wallets"        on wallets         for select using (user_id = auth.uid() or is_staff());
create policy "own ledger"         on ledger_entries  for select using (user_id = auth.uid() or is_staff());
create policy "own pay methods"    on payment_methods for select using (user_id = auth.uid());
create policy "own pay methods ins" on payment_methods for insert with check (user_id = auth.uid());
create policy "own pay methods del" on payment_methods for delete using (user_id = auth.uid());
create policy "own deposits"       on deposits        for select using (user_id = auth.uid() or is_staff());
create policy "own withdrawals"    on withdrawals     for select using (user_id = auth.uid() or is_staff());
create policy "own bets"           on bets            for select using (user_id = auth.uid() or is_staff());
create policy "own bet legs"       on bet_legs        for select using (
  exists (select 1 from bets b where b.id = bet_legs.bet_id and (b.user_id = auth.uid() or is_staff()))
);
create policy "own bonuses"        on user_bonuses    for select using (user_id = auth.uid() or is_staff());
create policy "own notifications"  on notifications   for select using (user_id = auth.uid());
create policy "own notif update"   on notifications   for update using (user_id = auth.uid());
create policy "staff audit read"   on audit_logs      for select using (is_staff());

-- Public catalogue (readable by everyone, writable only by service role / staff)
create policy "public currencies"   on currencies   for select using (true);
create policy "public sports"       on sports       for select using (is_active);
create policy "public leagues"      on leagues      for select using (is_active);
create policy "public teams"        on teams        for select using (true);
create policy "public events"       on events       for select using (true);
create policy "public market types" on market_types for select using (true);
create policy "public markets"      on markets      for select using (true);
create policy "public selections"   on selections   for select using (true);
create policy "public odds history" on odds_history for select using (true);
create policy "public promotions"   on promotions   for select using (is_active);
create policy "public settings"     on app_settings for select using (true);

-- Staff (traders/admins) can manage the catalogue from the dashboard
create policy "staff manage sports"     on sports       for all using (is_staff()) with check (is_staff());
create policy "staff manage leagues"    on leagues      for all using (is_staff()) with check (is_staff());
create policy "staff manage teams"      on teams        for all using (is_staff()) with check (is_staff());
create policy "staff manage events"     on events       for all using (is_staff()) with check (is_staff());
create policy "staff manage markets"    on markets      for all using (is_staff()) with check (is_staff());
create policy "staff manage selections" on selections   for all using (is_staff()) with check (is_staff());
create policy "staff manage promotions" on promotions   for all using (is_staff()) with check (is_staff());

-- =====================================================================
-- END
-- =====================================================================
