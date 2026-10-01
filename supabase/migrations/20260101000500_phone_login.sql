-- =====================================================================
-- SMARTBET — PHONE NUMBER AS A SECOND SIGN-IN IDENTIFIER
-- =====================================================================
-- Run this AFTER 20260101000400_password_auth.sql.
--
-- GOAL
--   A player can sign in with EITHER their email address OR the phone number
--   they registered with — same account, same password.
--
--   Signing in with an email is handled by Supabase Auth directly.
--   A phone number is not an email, so it needs one lookup step: "which account
--   does this phone number belong to?". That step is what this file provides —
--   and it is deliberately built so the lookup cannot be abused:
--
--   * resolve_phone_login(phone, password) returns the account's email ONLY when
--     the password is correct for that account. It verifies the bcrypt hash in
--     `auth.users.encrypted_password` with pgcrypto's crypt(), so a caller who
--     only knows a phone number learns nothing: wrong password → no rows, and
--     "no such phone" and "wrong password" return exactly the same (empty) result
--     at the same cost.
--   * Failed attempts are throttled per phone number (8 per 15 minutes), so the
--     function cannot be used as a brute-force oracle that bypasses GoTrue's own
--     rate limits.
--   * The browser then signs in normally with supabase.auth.signInWithPassword
--     using the resolved email + the password the player just typed, so GoTrue
--     verifies the password a second time and issues the session.
--
--   Nothing here needs the service-role key or an SMS provider.
--
-- WHY NOT SUPABASE'S NATIVE PHONE AUTH?
--   `signInWithPassword({ phone, password })` requires the Phone provider to be
--   enabled in the dashboard, which normally means an SMS gateway for the OTP
--   confirmation. This resolver works today with only the publishable key, and
--   the two approaches are compatible: if you later enable Phone auth and link
--   phone identities, email sign-in keeps working unchanged.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NORMALISATION (must match modules/auth/phone.ts → normalizePhone)
-- ---------------------------------------------------------------------
-- Uganda (+256) is the default country: 0772 000 000 → +256772000000.
create or replace function normalize_login_phone(p_input text) returns text
language plpgsql immutable as $$
declare
  d text := regexp_replace(coalesce(p_input, ''), '[^0-9+]', '', 'g');
begin
  if d = '' then return null; end if;

  if left(d, 1) = '+' then
    d := substr(d, 2);
  elsif left(d, 2) = '00' then
    d := substr(d, 3);
  elsif left(d, 1) = '0' then
    d := '256' || substr(d, 2);
  elsif left(d, 3) <> '256' then
    d := '256' || d;
  end if;

  if d !~ '^[0-9]{9,15}$' then return null; end if;
  return '+' || d;
end $$;

-- ---------------------------------------------------------------------
-- 2. LOOKUP SUPPORT
-- ---------------------------------------------------------------------
-- Phone sign-in is only unambiguous when one phone number belongs to one
-- account, so make that lookup fast.
create index if not exists idx_profiles_phone on profiles (phone) where phone is not null;

-- OPTIONAL (recommended once your data is clean): make the phone number unique
-- so two accounts can never share one. The resolver refuses to guess when a
-- number matches several accounts, so this is not required for correctness —
-- it just removes the ambiguity for players:
--   create unique index profiles_phone_unique on profiles (phone)
--     where phone is not null;

-- Attempt log, used only for throttling. RLS is on with no policies, so the
-- client roles can never read it; resolve_phone_login() is SECURITY DEFINER.
create table if not exists login_attempts (
  id           bigint generated always as identity primary key,
  identifier   text not null,                 -- normalised phone number
  success      boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_lookup
  on login_attempts (identifier, attempted_at desc);

alter table login_attempts enable row level security;

-- ---------------------------------------------------------------------
-- 3. THE RESOLVER
-- ---------------------------------------------------------------------
-- Returns the account email when the phone number and password belong together,
-- and nothing at all otherwise.
create or replace function resolve_phone_login(
  p_phone    text,
  p_password text
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phone    text := normalize_login_phone(p_phone);
  v_failures int;
  v_ids      uuid[];
  v_user_id  uuid;
  v_hash     text;
  v_email    text;
begin
  -- Never say which half was wrong.
  if v_phone is null or coalesce(p_password, '') = '' then
    return null;
  end if;

  -- Housekeeping: this identifier's attempts older than a day are irrelevant.
  delete from login_attempts
   where identifier = v_phone and attempted_at < now() - interval '1 day';

  select count(*) into v_failures
  from login_attempts
  where identifier = v_phone
    and not success
    and attempted_at > now() - interval '15 minutes';

  if v_failures >= 8 then
    insert into login_attempts (identifier, success) values (v_phone, false);
    raise exception 'too many attempts for this phone number, please try again in a few minutes';
  end if;

  select array_agg(p.id) into v_ids from profiles p where p.phone = v_phone;

  -- No account, or several accounts sharing the number: give up quietly, but
  -- spend the same time as a real check so the response cannot be used to test
  -- whether a phone number is registered.
  if v_ids is null or array_length(v_ids, 1) <> 1 then
    perform crypt(p_password, gen_salt('bf', 10));
    insert into login_attempts (identifier, success) values (v_phone, false);
    return null;
  end if;

  v_user_id := v_ids[1];

  select u.encrypted_password, u.email
    into v_hash, v_email
    from auth.users u
   where u.id = v_user_id;

  if v_hash is null or v_email is null or v_email = '' then
    insert into login_attempts (identifier, success) values (v_phone, false);
    return null;
  end if;

  -- GoTrue stores bcrypt hashes ($2a$…). Anything else (an OAuth-only account,
  -- for instance) cannot be checked here and must use email sign-in.
  if v_hash !~ '^\$2[abxy]\$' then
    insert into login_attempts (identifier, success) values (v_phone, false);
    raise exception 'this account cannot sign in with a phone number — use the email address';
  end if;

  if crypt(p_password, v_hash) <> v_hash then
    insert into login_attempts (identifier, success) values (v_phone, false);
    return null;
  end if;

  insert into login_attempts (identifier, success) values (v_phone, true);
  return v_email;
end $$;

-- ---------------------------------------------------------------------
-- 4. PRIVILEGES
-- ---------------------------------------------------------------------
-- Called from the app's server function with the publishable key (role anon).
-- The throttling and the "email only after a correct password" rule above are
-- what make this safe to expose.
revoke all on function resolve_phone_login(text, text) from public;
grant execute on function resolve_phone_login(text, text) to anon, authenticated;

revoke all on function normalize_login_phone(text) from public, anon, authenticated;

-- =====================================================================
-- VERIFY
-- =====================================================================
-- Registered phone numbers (normalised) and their accounts:
--   select p.phone, p.email, p.first_name, p.last_name, u.email_confirmed_at
--   from profiles p join auth.users u on u.id = p.id
--   where p.phone is not null order by p.created_at desc limit 10;
--
-- Same check the app performs (in SQL, with the plain password):
--   select resolve_phone_login('0772 000 000', 'the-password');
--   -- → the account email, or no rows when the pair is wrong
--
-- Recent phone sign-in attempts:
--   select identifier, success, attempted_at from login_attempts
--   order by attempted_at desc limit 20;
-- =====================================================================
