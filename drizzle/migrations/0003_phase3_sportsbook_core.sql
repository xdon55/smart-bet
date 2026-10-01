-- Phase 3 — Sportsbook core.
-- Authoritative catalogue (events / markets / selections) plus server-side bets.
-- The browser never supplies odds: place_bet re-reads prices from sb_selections.

CREATE TABLE public.sb_events (
  id text PRIMARY KEY,
  sport text NOT NULL,
  league text NOT NULL,
  country text NOT NULL,
  home text NOT NULL,
  away text NOT NULL,
  starts_label text NOT NULL,
  day_bucket text NOT NULL,
  is_live boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sb_events TO anon, authenticated;
GRANT ALL ON public.sb_events TO service_role;
ALTER TABLE public.sb_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are public" ON public.sb_events FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.sb_markets (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES public.sb_events(id) ON DELETE CASCADE,
  market_key text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  UNIQUE (event_id, market_key)
);
GRANT SELECT ON public.sb_markets TO anon, authenticated;
GRANT ALL ON public.sb_markets TO service_role;
ALTER TABLE public.sb_markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Markets are public" ON public.sb_markets FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.sb_selections (
  id bigserial PRIMARY KEY,
  market_id text NOT NULL REFERENCES public.sb_markets(id) ON DELETE CASCADE,
  selection_key text NOT NULL,
  label text NOT NULL,
  odds numeric(10,2) NOT NULL CHECK (odds > 1),
  status text NOT NULL DEFAULT 'open',
  UNIQUE (market_id, selection_key)
);
GRANT SELECT ON public.sb_selections TO anon, authenticated;
GRANT ALL ON public.sb_selections TO service_role;
ALTER TABLE public.sb_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Selections are public" ON public.sb_selections FOR SELECT TO anon, authenticated USING (true);

-- Player bets. Stake is debited through the same double-entry ledger as the wallet.
CREATE TABLE public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  stake numeric(14,2) NOT NULL CHECK (stake > 0),
  total_odds numeric(12,2) NOT NULL,
  potential_payout numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'UGX',
  status text NOT NULL DEFAULT 'open',
  transaction_id uuid REFERENCES public.transactions(id),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX bets_user_created_idx ON public.bets (user_id, created_at DESC);
GRANT SELECT ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bets" ON public.bets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all bets" ON public.bets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Frozen snapshot of each leg at placement time (odds can move afterwards).
CREATE TABLE public.bet_selections (
  id bigserial PRIMARY KEY,
  bet_id uuid NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  market_key text NOT NULL,
  selection_key text NOT NULL,
  event_label text NOT NULL,
  market_name text NOT NULL,
  selection_label text NOT NULL,
  odds numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'open'
);
CREATE INDEX bet_selections_bet_idx ON public.bet_selections (bet_id);
GRANT SELECT ON public.bet_selections TO authenticated;
GRANT ALL ON public.bet_selections TO service_role;
ALTER TABLE public.bet_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bet legs" ON public.bet_selections FOR SELECT TO authenticated
  USING (bet_id IN (SELECT id FROM public.bets WHERE user_id = auth.uid()));

-- Atomic bet placement: validates legs, re-prices from the catalogue, debits the
-- wallet through wallet_transact, and writes the bet + frozen legs in one transaction.
-- _picks is a JSON array of { eventId, marketKey, selectionKey }.
CREATE OR REPLACE FUNCTION public.place_bet(
  _user_id uuid,
  _stake numeric,
  _picks jsonb,
  _idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing uuid;
  v_pick jsonb;
  v_count int := 0;
  v_total numeric := 1;
  v_code text;
  v_bet_id uuid;
  v_tx uuid;
  v_min numeric;
  v_max_odds numeric := 10000;
  r record;
BEGIN
  SELECT id INTO v_existing FROM public.bets WHERE idempotency_key = _idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;   -- replay protection
  END IF;

  v_min := COALESCE((SELECT (value->>'min_stake')::numeric FROM public.platform_config WHERE key = 'betting'), 500);
  IF _stake IS NULL OR _stake < v_min THEN
    RAISE EXCEPTION 'stake below minimum of %', v_min;
  END IF;

  IF _picks IS NULL OR jsonb_array_length(_picks) = 0 THEN
    RAISE EXCEPTION 'no selections';
  END IF;

  CREATE TEMP TABLE _legs (
    event_id text, market_key text, selection_key text,
    event_label text, market_name text, selection_label text, odds numeric
  ) ON COMMIT DROP;

  FOR v_pick IN SELECT * FROM jsonb_array_elements(_picks) LOOP
    SELECT e.id AS event_id, m.market_key, s.selection_key,
           e.home || ' v ' || e.away AS event_label,
           m.name AS market_name, s.label AS selection_label, s.odds
      INTO r
      FROM public.sb_selections s
      JOIN public.sb_markets m ON m.id = s.market_id
      JOIN public.sb_events e ON e.id = m.event_id
     WHERE e.id = (v_pick->>'eventId')
       AND m.market_key = (v_pick->>'marketKey')
       AND s.selection_key = (v_pick->>'selectionKey')
       AND s.status = 'open' AND m.status = 'open' AND e.status = 'open';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'selection unavailable: % / % / %',
        v_pick->>'eventId', v_pick->>'marketKey', v_pick->>'selectionKey';
    END IF;

    -- One pick per event+market.
    IF EXISTS (SELECT 1 FROM _legs l WHERE l.event_id = r.event_id AND l.market_key = r.market_key) THEN
      RAISE EXCEPTION 'duplicate market on the same event';
    END IF;

    INSERT INTO _legs VALUES (r.event_id, r.market_key, r.selection_key,
                              r.event_label, r.market_name, r.selection_label, r.odds);
    v_total := v_total * r.odds;
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 30 THEN
    RAISE EXCEPTION 'too many selections';
  END IF;

  v_total := LEAST(ROUND(v_total, 2), v_max_odds);

  -- Debit the stake first; wallet_transact enforces funds and writes the ledger.
  v_tx := public.wallet_transact(
    _user_id, 'bet_stake', 'debit', _stake, 'sportsbook_liability',
    'bet:' || _idempotency_key, 'Bet stake', '{"source":"sportsbook"}'::jsonb
  );

  v_code := 'SB' || upper(substr(md5(gen_random_uuid()::text), 1, 5));

  INSERT INTO public.bets (user_id, code, stake, total_odds, potential_payout,
                           transaction_id, idempotency_key)
  VALUES (_user_id, v_code, _stake, v_total, ROUND(_stake * v_total, 2), v_tx, _idempotency_key)
  RETURNING id INTO v_bet_id;

  INSERT INTO public.bet_selections (bet_id, event_id, market_key, selection_key,
                                     event_label, market_name, selection_label, odds)
  SELECT v_bet_id, event_id, market_key, selection_key,
         event_label, market_name, selection_label, odds
    FROM _legs;

  RETURN v_bet_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_bet(uuid, numeric, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, numeric, jsonb, text) TO authenticated, service_role;