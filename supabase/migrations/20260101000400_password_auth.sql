-- =====================================================================
-- SMARTBET — PASSWORD AUTHENTICATION (Supabase Auth)
-- =====================================================================
-- Run this AFTER 20260101000000_betting_platform_schema.sql (and the
-- app-support file, which adds profiles.national_id).
--
-- HOW SIGN-IN WORKS
--   Credentials live in Supabase Auth's own `auth.users` table. Passwords are
--   hashed (bcrypt) by GoTrue and are never visible to this application, never
--   stored in `public`, and never sent anywhere except Supabase's auth endpoint
--   over HTTPS. The app only ever calls:
--       supabase.auth.signUp({ email, password, options: { data } })
--       supabase.auth.signInWithPassword({ email, password })
--       supabase.auth.resetPasswordForEmail(email)
--       supabase.auth.updateUser({ password })
--   so "checking the password" is Supabase's job, not the app's.
--
-- WHAT THIS FILE CHANGES
--   1. handle_new_user() — every confirmed signup gets a complete profile
--      (name, phone, date of birth, country, National ID, username) and a UGX
--      wallet, without needing the service-role key.
--   2. protect_profile_fields() — the existing trigger only guarded UPDATEs.
--      It now also guards INSERTs, which is what makes (3) safe.
--   3. "own profile insert" policy — a signed-in user whose profile row is
--      missing (trigger dropped, account imported, etc.) can create exactly one
--      row for themselves, with role/status/kyc_status forced.
--
-- DASHBOARD SETTINGS THAT MUST MATCH (Authentication → Sign In / Providers)
--   * Email provider ......... ENABLED
--   * Confirm email .......... your choice:
--        OFF → sign-up returns a session immediately (smoothest for testing)
--        ON  → the player must click the link before signing in; the app tells
--              them so and offers a resend
--   * Minimum password length  ≥ 8 (the app enforces 8 as well)
--   * Site URL ............... https://your-domain (and http://localhost:5173
--                              while developing)
--   * Redirect URLs .......... <Site URL>/auth  — required for the
--                              confirmation and password-reset links
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COMPLETE THE PROFILE ON SIGNUP
-- ---------------------------------------------------------------------
-- The registration form sends its details as Supabase Auth user metadata
-- (options.data), which arrives here as new.raw_user_meta_data. Because this
-- runs inside the GoTrue transaction, the profile is complete before the player
-- ever gets a session — no service-role key required.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_display  text  := nullif(trim(coalesce(v_meta ->> 'display_name', v_meta ->> 'full_name', '')), '');
  v_first    text;
  v_last     text;
  v_username text;
  v_phone    text  := nullif(trim(coalesce(v_meta ->> 'phone', '')), '');
  v_country  text  := upper(nullif(trim(coalesce(v_meta ->> 'country_code', '')), ''));
  v_dob      text  := nullif(trim(coalesce(v_meta ->> 'date_of_birth', '')), '');
  v_national text  := nullif(trim(coalesce(v_meta ->> 'national_id', '')), '');
begin
  -- "Jane Nakato" → first_name 'Jane', last_name 'Nakato'
  if v_display is not null then
    v_first := split_part(v_display, ' ', 1);
    v_last  := nullif(trim(substr(v_display, length(v_first) + 1)), '');
  end if;

  -- Username from metadata, else the email local part; de-duplicated so the
  -- unique constraint can never make a signup fail.
  v_username := nullif(
    lower(regexp_replace(
      coalesce(nullif(trim(coalesce(v_meta ->> 'username', '')), ''), split_part(coalesce(new.email, ''), '@', 1)),
      '[^a-zA-Z0-9_]', '', 'g')),
    '');
  if v_username is not null and exists (select 1 from profiles p where p.username = v_username) then
    v_username := v_username || '_' || substr(md5(random()::text), 1, 4);
  end if;

  insert into profiles (
    id, email, username, phone, first_name, last_name,
    date_of_birth, country_code, national_id, terms_accepted_at
  ) values (
    new.id, new.email, v_username, v_phone, v_first, v_last,
    case when v_dob ~ '^\d{4}-\d{2}-\d{2}$' then v_dob::date else null end,
    case when length(v_country) = 2 then v_country::char(2) else null end,
    v_national,
    case when coalesce((v_meta ->> 'terms_accepted')::boolean, false) then now() else null end
  )
  on conflict (id) do nothing;

  -- Every player starts with a UGX wallet (unique on user_id + currency).
  insert into wallets (user_id, currency) values (new.id, 'UGX')
  on conflict (user_id, currency) do nothing;

  return new;
end $$;

-- The trigger from the platform schema already points at this function; recreate
-- it only if it is missing (e.g. this file is re-run after a manual drop).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- 2. STOP PLAYERS ESCALATING THEIR OWN ACCOUNT (UPDATE *and* INSERT)
-- ---------------------------------------------------------------------
create or replace function protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service_role and the signup trigger (auth.uid() is null there) keep full
  -- control; everyone else can never choose their own role, status or KYC state.
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.role       := 'user';
      new.status     := 'active';
      new.kyc_status := 'none';
    else
      new.role       := old.role;
      new.status     := old.status;
      new.kyc_status := old.kyc_status;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_profile_insert on profiles;
create trigger trg_protect_profile_insert before insert on profiles
  for each row execute function protect_profile_fields();

-- ---------------------------------------------------------------------
-- 3. LET A SIGNED-IN USER CREATE THEIR OWN PROFILE ROW IF IT IS MISSING
-- ---------------------------------------------------------------------
-- Safe because of (2): the protected columns are forced, and the check clause
-- pins the row to the caller's own id.
drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles
  for insert with check (id = auth.uid());

-- =====================================================================
-- VERIFY
-- =====================================================================
-- After registering a test account in the app:
--   select p.id, p.email, p.username, p.first_name, p.last_name, p.phone,
--          p.date_of_birth, p.national_id, p.terms_accepted_at,
--          w.currency, w.balance
--   from profiles p left join wallets w on w.user_id = p.id
--   order by p.created_at desc limit 3;
-- Expect: exactly one profile + one UGX wallet per auth user.
--
-- Passwords are visible only as a hash, and only to the auth service:
--   select id, email, email_confirmed_at, encrypted_password is not null as has_password,
--          created_at, last_sign_in_at
--   from auth.users order by created_at desc limit 5;
-- =====================================================================
