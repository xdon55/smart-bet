-- =====================================================================
-- SMARTBET WEB APP — SUPPORT OBJECTS
-- =====================================================================
-- Run this AFTER 20260101000000_betting_platform_schema.sql.
--
-- The betting-platform schema is the source of truth for money, bets and the
-- catalogue. This file adds only what the SMARTBET web application needs on top
-- of it. Everything here is ADDITIVE: no table, column or policy from the
-- platform schema is altered or dropped.
--
--   1. profiles.national_id        — National ID / NIN captured at registration
--   2. phone_otps                  — phone-signup OTP codes (server-only)
--   3. manual_deposits_enabled     — feature flag for the interim deposit path
--   4. deposits insert policy      — lets a player open their OWN pending deposit
--   5. claim_manual_deposit()      — user-callable settlement of their own
--                                    pending deposit, gated by (3)
--
-- ⚠ TURN OFF (3) BEFORE GOING LIVE with a real payment provider. While the flag
--   is on, a signed-in player can credit their own wallet without paying.
--   With it off, `claim_manual_deposit` raises an exception and only the service
--   role (payment webhook → complete_deposit) can complete a deposit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. National ID / NIN on the profile
-- ---------------------------------------------------------------------
-- Captured by the registration form. Kept as text on profiles until the player
-- submits scanned documents into kyc_documents.
alter table profiles add column if not exists national_id text;

-- ---------------------------------------------------------------------
-- 2. Phone signup OTP codes
-- ---------------------------------------------------------------------
-- RLS is enabled with NO policies, so the anon and authenticated roles cannot
-- read codes: only the service-role key (used inside server functions) can.
create table if not exists phone_otps (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code        text not null,
  purpose     text not null default 'signup',
  attempts    int not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_phone_otps_lookup on phone_otps (phone, purpose, created_at desc);

alter table phone_otps enable row level security;

-- ---------------------------------------------------------------------
-- 3. Interim deposit feature flag
-- ---------------------------------------------------------------------
insert into app_settings (key, value, description) values
  ('manual_deposits_enabled', 'true',
   'Interim: allow a signed-in player to settle their own pending deposit while no payment provider is connected. Set to false in production.')
on conflict (key) do update
  set description = excluded.description;

-- ---------------------------------------------------------------------
-- 4. Players may open their own deposit (always pending)
-- ---------------------------------------------------------------------
-- Without this, `deposits` is write-only from the service role. The check clause
-- pins status to 'pending', so a client can never insert a completed deposit;
-- crediting still happens only inside complete_deposit().
drop policy if exists "own deposits insert" on deposits;
create policy "own deposits insert" on deposits
  for insert with check (user_id = auth.uid() and status = 'pending');

-- ---------------------------------------------------------------------
-- 5. Settle your own pending deposit (interim path, flag-gated)
-- ---------------------------------------------------------------------
create or replace function claim_manual_deposit(p_deposit_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d          deposits%rowtype;
  v_enabled  boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select coalesce((value #>> '{}')::boolean, false)
    into v_enabled
    from app_settings where key = 'manual_deposits_enabled';
  if not coalesce(v_enabled, false) then
    raise exception 'manual deposits are disabled — use a payment provider';
  end if;

  select * into d from deposits where id = p_deposit_id for update;
  if not found then raise exception 'deposit not found'; end if;
  if d.user_id <> auth.uid() then raise exception 'not your deposit'; end if;
  if d.status <> 'pending' then raise exception 'deposit already finalised'; end if;

  perform complete_deposit(d.id);
end $$;

revoke all on function claim_manual_deposit(uuid) from public, anon;
grant execute on function claim_manual_deposit(uuid) to authenticated;

-- =====================================================================
-- HANDY ADMIN SNIPPETS (run manually in the SQL editor, not by the app)
-- =====================================================================
-- Verify a player's KYC so withdrawals are allowed:
--   update profiles set kyc_status = 'verified' where id = '<user-uuid>';
--
-- Promote a player to trader/admin (needed for the staff RLS policies):
--   update profiles set role = 'admin' where id = '<user-uuid>';
--
-- Credit a wallet by hand (goes through the real ledger, never a raw update):
--   select post_ledger_entry(
--     (select id from wallets where user_id = '<user-uuid>' and currency = 'UGX'),
--     'adjustment', 50000, null, 'manual', 'manual:bonus:<uuid>', 'Manual goodwill credit');
--
-- Close the manual deposit hole once a provider is live:
--   update app_settings set value = 'false' where key = 'manual_deposits_enabled';
-- =====================================================================
