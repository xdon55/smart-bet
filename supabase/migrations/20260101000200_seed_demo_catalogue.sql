-- =====================================================================
-- SMARTBET — DEMO CATALOGUE SEED
-- =====================================================================
-- Run this AFTER the schema and the app-support file.
--
-- Loads the SMARTBET launch fixtures into the real catalogue tables so the site
-- renders live database rows and every odds button is bettable through
-- place_bet(p_stake, p_selection_ids).
--
-- Idempotent: every row id is a deterministic UUID derived from a stable key
-- (md5 of 'smartbet:<key>'), and every insert ends in ON CONFLICT DO NOTHING.
-- Re-running the file changes nothing. Odds are NOT updated on re-run — change
-- prices with normal UPDATE statements on `selections` (logged to odds_history).
--
-- Kickoff times are relative to now(), so the demo fixtures are always in the
-- future (or in-play) whenever you run this.
--
-- Replace this data with your odds feed when one is connected: the app only
-- needs rows in sports / leagues / teams / events / markets / selections.
-- =====================================================================

-- Deterministic key -> uuid, e.g. _seed_uuid('event:m1')
create or replace function _seed_uuid(p_key text) returns uuid
language sql immutable as $$
  select ('00000000-0000-4000-8000-' || substr(md5('smartbet:' || p_key), 1, 12))::uuid
$$;

-- ---------------------------------------------------------------------
-- 1. SPORTS
-- ---------------------------------------------------------------------
insert into sports (id, name, slug, sort_order, is_active)
select _seed_uuid('sport:' || v.slug), v.name, v.slug, v.sort_order, true
from (values
  ('football',   'Football',   1),
  ('basketball', 'Basketball', 2),
  ('tennis',     'Tennis',     3),
  ('cricket',    'Cricket',    4),
  ('rugby',      'Rugby',      5),
  ('volleyball', 'Volleyball', 6),
  ('esports',    'eSports',    7),
  ('boxing',     'Boxing',     8)
) as v(slug, name, sort_order)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. LEAGUES  (country_code drives the flag shown next to each fixture)
-- ---------------------------------------------------------------------
insert into leagues (id, sport_id, name, slug, country_code, sort_order, is_active)
select _seed_uuid('league:' || v.slug), s.id, v.name, v.slug, v.country_code, v.sort_order, true
from (values
  ('football',   'uganda-premier-league',  'Uganda Premier League',  'UG', 1),
  ('football',   'premier-league',         'Premier League',         'GB', 2),
  ('football',   'la-liga',                'La Liga',                'ES', 3),
  ('football',   'serie-a',                'Serie A',                'IT', 4),
  ('football',   'bundesliga',             'Bundesliga',             'DE', 5),
  ('football',   'ligue-1',                'Ligue 1',                'FR', 6),
  ('football',   'caf-champions-league',   'CAF Champions League',   'XA', 7),
  ('basketball', 'nba',                    'NBA',                    'US', 8),
  ('tennis',     'atp-masters',            'ATP Masters',            'FR', 9)
) as v(sport_slug, slug, name, country_code, sort_order)
join sports s on s.slug = v.sport_slug
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. TEAMS / PLAYERS
-- ---------------------------------------------------------------------
insert into teams (id, sport_id, name, short_name, country_code)
select _seed_uuid('team:' || v.sport_slug || ':' || v.name), s.id, v.name, v.short_name, v.country_code
from (values
  ('football',   'Vipers SC',                  'Vipers',   'UG'),
  ('football',   'KCCA FC',                    'KCCA',     'UG'),
  ('football',   'Express FC',                 'Express',  'UG'),
  ('football',   'SC Villa',                   'Villa',    'UG'),
  ('football',   'Arsenal',                    'ARS',      'GB'),
  ('football',   'Liverpool',                  'LIV',      'GB'),
  ('football',   'Chelsea',                    'CHE',      'GB'),
  ('football',   'Everton',                    'EVE',      'GB'),
  ('football',   'Real Betis',                 'BET',      'ES'),
  ('football',   'Sevilla',                    'SEV',      'ES'),
  ('football',   'Inter',                      'INT',      'IT'),
  ('football',   'Napoli',                     'NAP',      'IT'),
  ('football',   'Bayern München',             'FCB',      'DE'),
  ('football',   'RB Leipzig',                 'RBL',      'DE'),
  ('football',   'PSG',                        'PSG',      'FR'),
  ('football',   'Marseille',                  'OM',       'FR'),
  ('football',   'Al Ahly',                    'AHL',      'EG'),
  ('football',   'Mamelodi Sundowns',          'SUN',      'ZA'),
  ('basketball', 'Boston Celtics',             'BOS',      'US'),
  ('basketball', 'Denver Nuggets',             'DEN',      'US'),
  ('basketball', 'LA Lakers',                  'LAL',      'US'),
  ('basketball', 'Golden State Warriors',      'GSW',      'US'),
  ('tennis',     'C. Alcaraz',                 'ALC',      'ES'),
  ('tennis',     'J. Sinner',                  'SIN',      'IT')
) as v(sport_slug, name, short_name, country_code)
join sports s on s.slug = v.sport_slug
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. MARKET TYPES (templates the catalogue hangs markets off)
-- ---------------------------------------------------------------------
insert into market_types (id, sport_id, code, name, description)
select _seed_uuid('market_type:' || v.code), s.id, v.code, v.name, v.description
from (values
  ('football', 'MATCH_WINNER',  '1X2',                 'Home / Draw / Away'),
  (null,       'OVER_UNDER',    'Over / Under',        'Total goals or points over/under a line'),
  ('football', 'BTTS',          'Both teams to score', 'Both teams to score at least one goal'),
  (null,       'WINNER',        'Winner',              'Two-way head-to-head winner'),
  ('football', 'DOUBLE_CHANCE', 'Double chance',       'Two of the three 1X2 outcomes'),
  ('football', 'DRAW_NO_BET',   'Draw no bet',         'Stake refunded if the match is drawn'),
  ('football', 'HALF_TIME',     'Half time result',    '1X2 at half time'),
  ('football', 'CORRECT_SCORE', 'Correct score',       'Exact full-time score')
) as v(sport_slug, code, name, description)
left join sports s on s.slug = v.sport_slug
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 5. EVENTS (fixtures)
-- ---------------------------------------------------------------------
-- status 'live' events have already kicked off and carry minute/scores in
-- result_data; markets on them are flagged is_live so place_bet allows them.
insert into events (id, league_id, home_team_id, away_team_id, name, starts_at, status,
                    home_score, away_score, result_data, external_id, is_featured)
select _seed_uuid('event:' || v.external_id),
       l.id, hm.id, aw.id, v.name,
       now() + v.offset_interval,
       v.status::event_status,
       v.home_score, v.away_score,
       coalesce(v.result_data, '{}'::jsonb),
       v.external_id, v.is_featured
from (values
  ('m1','football','uganda-premier-league','Vipers SC','KCCA FC','Vipers SC vs KCCA FC',
   interval '5 hours','scheduled', null::int, null::int, null::jsonb, true),
  ('m2','football','premier-league','Arsenal','Liverpool','Arsenal vs Liverpool',
   interval '-1 hours','live', 1, 1, '{"minute":63}'::jsonb, true),
  ('m3','football','la-liga','Real Betis','Sevilla','Real Betis vs Sevilla',
   interval '1 day 4 hours','scheduled', null, null, null, false),
  ('m4','football','serie-a','Inter','Napoli','Inter vs Napoli',
   interval '-30 minutes','live', 0, 0, '{"minute":28}'::jsonb, true),
  ('m5','basketball','nba','Boston Celtics','Denver Nuggets','Boston Celtics vs Denver Nuggets',
   interval '1 day 10 hours','scheduled', null, null, null, false),
  ('m6','tennis','atp-masters','C. Alcaraz','J. Sinner','C. Alcaraz vs J. Sinner',
   interval '-20 minutes','live', 1, 0, '{"minute":1,"set":1}'::jsonb, false),
  ('m7','football','caf-champions-league','Al Ahly','Mamelodi Sundowns','Al Ahly vs Mamelodi Sundowns',
   interval '3 days 2 hours','scheduled', null, null, null, true),
  ('m8','football','bundesliga','Bayern München','RB Leipzig','Bayern München vs RB Leipzig',
   interval '4 days 3 hours','scheduled', null, null, null, true),
  ('m9','football','uganda-premier-league','Express FC','SC Villa','Express FC vs SC Villa',
   interval '2 days 5 hours','scheduled', null, null, null, false),
  ('m10','football','premier-league','Chelsea','Everton','Chelsea vs Everton',
   interval '2 days 9 hours','scheduled', null, null, null, false),
  ('m11','football','ligue-1','PSG','Marseille','PSG vs Marseille',
   interval '1 day 8 hours','scheduled', null, null, null, true),
  ('m12','basketball','nba','LA Lakers','Golden State Warriors','LA Lakers vs Golden State Warriors',
   interval '3 days 11 hours','scheduled', null, null, null, false)
) as v(external_id, sport_slug, league_slug, home_name, away_name, name,
       offset_interval, status, home_score, away_score, result_data, is_featured)
join sports  s  on s.slug = v.sport_slug
join leagues l  on l.sport_id = s.id and l.slug = v.league_slug
join teams   hm on hm.sport_id = s.id and hm.name = v.home_name
join teams   aw on aw.sport_id = s.id and aw.name = v.away_name
on conflict (external_id) do nothing;

-- ---------------------------------------------------------------------
-- 6. MARKETS
-- ---------------------------------------------------------------------
insert into markets (id, event_id, market_type_id, name, line, status, is_live)
select _seed_uuid('market:' || v.event_external_id || ':' || v.market_key),
       e.id, mt.id, v.name, v.line, 'open'::market_status, v.is_live
from (values
  -- Vipers SC vs KCCA FC
  ('m1','1x2','MATCH_WINNER','1X2', null::numeric, false),
  ('m1','ou25','OVER_UNDER','Total goals 2.5', 2.5, false),
  ('m1','btts','BTTS','Both teams to score', null, false),
  -- Arsenal vs Liverpool (in play — extra markets to exercise the detail page)
  ('m2','1x2','MATCH_WINNER','1X2', null, true),
  ('m2','ou25','OVER_UNDER','Total goals 2.5', 2.5, true),
  ('m2','btts','BTTS','Both teams to score', null, true),
  ('m2','dc','DOUBLE_CHANCE','Double chance', null, true),
  ('m2','ou15','OVER_UNDER','Total goals 1.5', 1.5, true),
  ('m2','dnb','DRAW_NO_BET','Draw no bet', null, true),
  -- Real Betis vs Sevilla
  ('m3','1x2','MATCH_WINNER','1X2', null, false),
  ('m3','ou25','OVER_UNDER','Total goals 2.5', 2.5, false),
  ('m3','btts','BTTS','Both teams to score', null, false),
  -- Inter vs Napoli
  ('m4','1x2','MATCH_WINNER','1X2', null, true),
  ('m4','ou25','OVER_UNDER','Total goals 2.5', 2.5, true),
  ('m4','btts','BTTS','Both teams to score', null, true),
  -- Boston Celtics vs Denver Nuggets
  ('m5','ml','WINNER','Winner', null, false),
  ('m5','ou220','OVER_UNDER','Total points 220.5', 220.5, false),
  -- C. Alcaraz vs J. Sinner
  ('m6','ml','WINNER','Winner', null, true),
  -- Al Ahly vs Mamelodi Sundowns
  ('m7','1x2','MATCH_WINNER','1X2', null, false),
  ('m7','ou25','OVER_UNDER','Total goals 2.5', 2.5, false),
  ('m7','btts','BTTS','Both teams to score', null, false),
  -- Bayern München vs RB Leipzig
  ('m8','1x2','MATCH_WINNER','1X2', null, false),
  ('m8','ou25','OVER_UNDER','Total goals 2.5', 2.5, false),
  ('m8','btts','BTTS','Both teams to score', null, false),
  -- Express FC vs SC Villa
  ('m9','1x2','MATCH_WINNER','1X2', null, false),
  ('m9','ou25','OVER_UNDER','Total goals 2.5', 2.5, false),
  ('m9','btts','BTTS','Both teams to score', null, false),
  -- Chelsea vs Everton
  ('m10','1x2','MATCH_WINNER','1X2', null, false),
  ('m10','ou25','OVER_UNDER','Total goals 2.5', 2.5, false),
  ('m10','btts','BTTS','Both teams to score', null, false),
  -- PSG vs Marseille
  ('m11','1x2','MATCH_WINNER','1X2', null, false),
  ('m11','ou25','OVER_UNDER','Total goals 2.5', 2.5, false),
  ('m11','btts','BTTS','Both teams to score', null, false),
  -- LA Lakers vs Golden State Warriors
  ('m12','ml','WINNER','Winner', null, false)
) as v(event_external_id, market_key, market_type_code, name, line, is_live)
join events e on e.external_id = v.event_external_id
join market_types mt on mt.code = v.market_type_code
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 7. SELECTIONS (prices)
-- ---------------------------------------------------------------------
insert into selections (id, market_id, name, odds, status, sort_order)
select _seed_uuid('selection:' || v.event_external_id || ':' || v.market_key || ':' || v.selection_key),
       m.id, v.name, v.odds, 'active'::selection_status, v.sort_order
from (values
  -- 1X2
  ('m1','1x2','1','Home',2.050,1), ('m1','1x2','X','Draw',3.100,2), ('m1','1x2','2','Away',3.600,3),
  ('m2','1x2','1','Home',2.450,1), ('m2','1x2','X','Draw',3.400,2), ('m2','1x2','2','Away',2.700,3),
  ('m3','1x2','1','Home',2.900,1), ('m3','1x2','X','Draw',3.150,2), ('m3','1x2','2','Away',2.400,3),
  ('m4','1x2','1','Home',1.950,1), ('m4','1x2','X','Draw',3.300,2), ('m4','1x2','2','Away',4.100,3),
  ('m7','1x2','1','Home',2.200,1), ('m7','1x2','X','Draw',3.050,2), ('m7','1x2','2','Away',3.300,3),
  ('m8','1x2','1','Home',1.550,1), ('m8','1x2','X','Draw',4.200,2), ('m8','1x2','2','Away',5.400,3),
  ('m9','1x2','1','Home',2.400,1), ('m9','1x2','X','Draw',3.000,2), ('m9','1x2','2','Away',2.950,3),
  ('m10','1x2','1','Home',1.680,1), ('m10','1x2','X','Draw',3.800,2), ('m10','1x2','2','Away',4.800,3),
  ('m11','1x2','1','Home',1.450,1), ('m11','1x2','X','Draw',4.600,2), ('m11','1x2','2','Away',6.000,3),
  -- Total goals 2.5
  ('m1','ou25','over','Over 2.5',1.850,1), ('m1','ou25','under','Under 2.5',1.900,2),
  ('m2','ou25','over','Over 2.5',1.620,1), ('m2','ou25','under','Under 2.5',2.250,2),
  ('m3','ou25','over','Over 2.5',1.950,1), ('m3','ou25','under','Under 2.5',1.800,2),
  ('m4','ou25','over','Over 2.5',2.100,1), ('m4','ou25','under','Under 2.5',1.700,2),
  ('m7','ou25','over','Over 2.5',2.000,1), ('m7','ou25','under','Under 2.5',1.750,2),
  ('m8','ou25','over','Over 2.5',1.480,1), ('m8','ou25','under','Under 2.5',2.600,2),
  ('m9','ou25','over','Over 2.5',2.050,1), ('m9','ou25','under','Under 2.5',1.720,2),
  ('m10','ou25','over','Over 2.5',1.700,1), ('m10','ou25','under','Under 2.5',2.100,2),
  ('m11','ou25','over','Over 2.5',1.420,1), ('m11','ou25','under','Under 2.5',2.750,2),
  -- Both teams to score
  ('m1','btts','yes','Yes',1.780,1), ('m1','btts','no','No',1.950,2),
  ('m2','btts','yes','Yes',1.550,1), ('m2','btts','no','No',2.350,2),
  ('m3','btts','yes','Yes',1.700,1), ('m3','btts','no','No',2.050,2),
  ('m4','btts','yes','Yes',1.880,1), ('m4','btts','no','No',1.850,2),
  ('m7','btts','yes','Yes',1.820,1), ('m7','btts','no','No',1.900,2),
  ('m8','btts','yes','Yes',1.600,1), ('m8','btts','no','No',2.250,2),
  ('m9','btts','yes','Yes',1.850,1), ('m9','btts','no','No',1.880,2),
  ('m10','btts','yes','Yes',1.750,1), ('m10','btts','no','No',2.000,2),
  ('m11','btts','yes','Yes',1.680,1), ('m11','btts','no','No',2.100,2),
  -- Double chance (Arsenal vs Liverpool)
  ('m2','dc','1x','Home or Draw',1.320,1), ('m2','dc','12','Home or Away',1.280,2), ('m2','dc','x2','Draw or Away',1.550,3),
  -- Total goals 1.5 (Arsenal vs Liverpool)
  ('m2','ou15','over','Over 1.5',1.280,1), ('m2','ou15','under','Under 1.5',3.400,2),
  -- Draw no bet (Arsenal vs Liverpool)
  ('m2','dnb','1','Arsenal',1.720,1), ('m2','dnb','2','Liverpool',2.050,2),
  -- Winner (two-way)
  ('m5','ml','1','Boston Celtics',1.720,1), ('m5','ml','2','Denver Nuggets',2.100,2),
  ('m6','ml','1','C. Alcaraz',1.950,1), ('m6','ml','2','J. Sinner',1.850,2),
  ('m12','ml','1','LA Lakers',2.050,1), ('m12','ml','2','Golden State Warriors',1.780,2),
  -- Total points 220.5 (NBA)
  ('m5','ou220','over','Over 220.5',1.900,1), ('m5','ou220','under','Under 220.5',1.900,2)
) as v(event_external_id, market_key, selection_key, name, odds, sort_order)
join markets m on m.id = _seed_uuid('market:' || v.event_external_id || ':' || v.market_key)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 8. PROMOTIONS (referenced by the home-page banners)
-- ---------------------------------------------------------------------
insert into promotions (id, code, name, description, bonus_type, match_percent,
                        max_bonus_amount, min_deposit, wagering_multiplier, min_odds, is_active)
select _seed_uuid('promo:' || v.code), v.code, v.name, v.description,
       v.bonus_type::bonus_type, v.match_percent, v.max_bonus_amount, v.min_deposit,
       v.wagering_multiplier, v.min_odds, true
from (values
  ('WELCOME100','100% first deposit boost','Double your first top-up up to UGX 100,000.',
   'deposit_match', 100.0, 100000, 5000, 5.0, 1.80),
  ('MULTI200','Multibet bonus','Up to 200% extra on winning slips with 5+ selections.',
   'free_bet', null::numeric, 200000, null::numeric, 1.0, 1.50),
  ('FREEFRI',  'Free bet Fridays','Stake UGX 5,000 on Friday and get UGX 2,000 free.',
   'no_deposit', null, null, null, 3.0, 1.80)
) as v(code, name, description, bonus_type, match_percent, max_bonus_amount,
       min_deposit, wagering_multiplier, min_odds)
on conflict do nothing;

-- Clean up the helper — it has done its job and is not part of the schema.
drop function if exists _seed_uuid(text);

-- =====================================================================
-- Sanity check (optional). Expect:
--   sports 8, leagues 9, teams 24, market_types 8,
--   events 12, markets 34, selections 78, promotions 3
-- =====================================================================
-- select
--   (select count(*) from sports)     as sports,
--   (select count(*) from leagues)    as leagues,
--   (select count(*) from teams)      as teams,
--   (select count(*) from market_types) as market_types,
--   (select count(*) from events)     as events,
--   (select count(*) from markets)    as markets,
--   (select count(*) from selections) as selections,
--   (select count(*) from promotions) as promotions;
-- =====================================================================
