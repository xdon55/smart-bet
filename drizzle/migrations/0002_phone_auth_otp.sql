-- Phase 1 addendum: phone-first authentication.
-- OTP codes are issued and verified server-side only. No client role gets access;
-- all reads/writes go through the service-role admin client in server functions.
-- TODO(integration): replace the on-screen code with a real SMS send (Twilio etc.).
CREATE TABLE public.phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL DEFAULT 'signup',
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phone_otps_phone_idx ON public.phone_otps (phone, created_at DESC);

GRANT ALL ON public.phone_otps TO service_role;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service role (server functions) may touch this table.

-- Optional contact email supplied at registration (the auth email is synthetic,
-- derived from the phone number, so the real address lives on the profile).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;