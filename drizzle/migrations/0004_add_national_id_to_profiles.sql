-- Phase 1 follow-up: store the player's National ID (NIN) captured at registration.
-- Nullable so existing accounts are unaffected; KYC verification comes in a later phase.
ALTER TABLE public.profiles ADD COLUMN national_id TEXT;
COMMENT ON COLUMN public.profiles.national_id IS 'National ID / NIN captured at registration; verified in the KYC phase.';