/**
 * betting-data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared UI shapes, formatters and the DEMO FALLBACK catalogue.
 *
 * WHERE THE DATA COMES FROM
 * - The site reads its catalogue from the Supabase tables `sports`, `leagues`,
 *   `teams`, `events`, `markets` (joined to `market_types` for `code`) and
 *   `selections`. That mapping lives in modules/sportsbook/catalogue.functions.ts
 *   and is served to the UI by the provider in lib/catalogue.tsx.
 * - `demoMatches` below is ONLY used when the database cannot be reached or is
 *   still empty, so the interface never renders blank. Selections from the demo
 *   set do not exist in the database, so the bet slip refuses to place them: the
 *   slip only accepts selections that carry a real database id (see
 *   toSelection in lib/betslip.tsx).
 * - Ids: in database mode `Match.id`, `Market.id` and `Outcome.id` are the real
 *   UUIDs from `events`, `markets` and `selections`. `Market.code` is the
 *   `market_types.code` template ('MATCH_WINNER', 'OVER_UNDER', ...).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A single selectable price inside a market (e.g. "Home" @ 2.05). */
export type Outcome = {
  /** `selections.id` (uuid) when the price came from the database. */
  id: string;
  label: string;
  odds: number;
  /** False for demo-fallback prices, which cannot be bet on. */
  bettable?: boolean;
};

/** A betting market attached to a match (e.g. 1X2, Total goals 2.5). */
export type Market = {
  /** `markets.id` (uuid) when the market came from the database. */
  id: string;
  /** `market_types.code` — the template this market was built from. */
  code: string;
  name: string;
  outcomes: Outcome[];
};

/** Kickoff buckets used by the "kickoff time" filter on the sports page. */
export type KickoffDay = "today" | "tomorrow" | "day-after" | "this-week";

/**
 * A fixture/event. `live` is optional — when present the event is treated as
 * in-play everywhere (live badge, score, /live page). `markets` holds the
 * prices shown on cards; `marketCount` is the number of markets the book has
 * open on this event, shown on the "+N" button.
 */
export type Match = {
  /** `events.id` (uuid) when the fixture came from the database. */
  id: string;
  sport: string;
  league: string;
  country: string;
  countryCode: string | null;
  home: string;
  away: string;
  startsAt: string;
  /** Raw ISO kickoff timestamp (null for demo fixtures). */
  startsAtIso: string | null;
  day: KickoffDay;
  popular?: boolean;
  live?: { minute: number; homeScore: number; awayScore: number };
  marketCount: number;
  markets: Market[];
  /** True when every price on this fixture is a real, bettable database row. */
  bettable: boolean;
};

/* ── Market builder helpers (demo fallback only) ────────────────────────────
 * Small factories so the fallback fixtures stay readable. Database rows are
 * mapped to the same { id, code, name, outcomes[] } shape by
 * modules/sportsbook/catalogue.functions.ts.
 * ──────────────────────────────────────────────────────────────────────── */

const oneX2 = (h: number, d: number, a: number): Market => ({
  id: "1x2",
  code: "MATCH_WINNER",
  name: "1X2",
  outcomes: [
    { id: "1", label: "Home", odds: h },
    { id: "X", label: "Draw", odds: d },
    { id: "2", label: "Away", odds: a },
  ],
});

const goals = (over: number, under: number): Market => ({
  id: "ou25",
  code: "OVER_UNDER",
  name: "Total goals 2.5",
  outcomes: [
    { id: "over", label: "Over 2.5", odds: over },
    { id: "under", label: "Under 2.5", odds: under },
  ],
});

const btts = (yes: number, no: number): Market => ({
  id: "btts",
  code: "BTTS",
  name: "Both teams to score",
  outcomes: [
    { id: "yes", label: "Yes", odds: yes },
    { id: "no", label: "No", odds: no },
  ],
});

const winner = (h: number, a: number): Market => ({
  id: "ml",
  code: "WINNER",
  name: "Winner",
  outcomes: [
    { id: "1", label: "Home", odds: h },
    { id: "2", label: "Away", odds: a },
  ],
});

/* ── Demo fallback fixtures ─────────────────────────────────────────────────
 * Mirrors supabase/migrations/*_seed_demo_catalogue.sql. Used only when the
 * catalogue query fails or the database has no events yet.
 * ──────────────────────────────────────────────────────────────────────── */
export const demoMatches: Match[] = [
  {
    id: "m1",
    sport: "Football",
    league: "Uganda Premier League",
    country: "Uganda",
    countryCode: "UG",
    home: "Vipers SC",
    away: "KCCA FC",
    startsAt: "Today 18:00",
    startsAtIso: null,
    day: "today",
    popular: true,
    marketCount: 3,
    bettable: false,
    markets: [oneX2(2.05, 3.1, 3.6), goals(1.85, 1.9), btts(1.78, 1.95)],
  },
  {
    id: "m2",
    sport: "Football",
    league: "Premier League",
    country: "England",
    countryCode: "GB",
    home: "Arsenal",
    away: "Liverpool",
    startsAt: "Today 20:30",
    startsAtIso: null,
    day: "today",
    popular: true,
    live: { minute: 63, homeScore: 1, awayScore: 1 },
    marketCount: 3,
    bettable: false,
    markets: [oneX2(2.45, 3.4, 2.7), goals(1.62, 2.25), btts(1.55, 2.35)],
  },
  {
    id: "m3",
    sport: "Football",
    league: "La Liga",
    country: "Spain",
    countryCode: "ES",
    home: "Real Betis",
    away: "Sevilla",
    startsAt: "Tomorrow 22:00",
    startsAtIso: null,
    day: "tomorrow",
    marketCount: 3,
    bettable: false,
    markets: [oneX2(2.9, 3.15, 2.4), goals(1.95, 1.8), btts(1.7, 2.05)],
  },
  {
    id: "m4",
    sport: "Football",
    league: "Serie A",
    country: "Italy",
    countryCode: "IT",
    home: "Inter",
    away: "Napoli",
    startsAt: "Today 19:45",
    startsAtIso: null,
    day: "today",
    popular: true,
    live: { minute: 28, homeScore: 0, awayScore: 0 },
    marketCount: 3,
    bettable: false,
    markets: [oneX2(1.95, 3.3, 4.1), goals(2.1, 1.7), btts(1.88, 1.85)],
  },
  {
    id: "m5",
    sport: "Basketball",
    league: "NBA",
    country: "USA",
    countryCode: "US",
    home: "Boston Celtics",
    away: "Denver Nuggets",
    startsAt: "Tomorrow 03:30",
    startsAtIso: null,
    day: "tomorrow",
    marketCount: 2,
    bettable: false,
    markets: [winner(1.72, 2.1), goals(1.9, 1.9)],
  },
  {
    id: "m6",
    sport: "Tennis",
    league: "ATP Masters",
    country: "France",
    countryCode: "FR",
    home: "C. Alcaraz",
    away: "J. Sinner",
    startsAt: "Today 16:00",
    startsAtIso: null,
    day: "today",
    live: { minute: 1, homeScore: 1, awayScore: 0 },
    marketCount: 1,
    bettable: false,
    markets: [winner(1.95, 1.85)],
  },
  {
    id: "m7",
    sport: "Football",
    league: "CAF Champions League",
    country: "Africa",
    countryCode: "XA",
    home: "Al Ahly",
    away: "Mamelodi Sundowns",
    startsAt: "Sat 17:00",
    startsAtIso: null,
    day: "this-week",
    popular: true,
    marketCount: 3,
    bettable: false,
    markets: [oneX2(2.2, 3.05, 3.3), goals(2.0, 1.75), btts(1.82, 1.9)],
  },
  {
    id: "m8",
    sport: "Football",
    league: "Bundesliga",
    country: "Germany",
    countryCode: "DE",
    home: "Bayern München",
    away: "RB Leipzig",
    startsAt: "Sun 18:30",
    startsAtIso: null,
    day: "this-week",
    popular: true,
    marketCount: 3,
    bettable: false,
    markets: [oneX2(1.55, 4.2, 5.4), goals(1.48, 2.6), btts(1.6, 2.25)],
  },
  {
    id: "m9",
    sport: "Football",
    league: "Uganda Premier League",
    country: "Uganda",
    countryCode: "UG",
    home: "Express FC",
    away: "SC Villa",
    startsAt: "Wed 16:00",
    startsAtIso: null,
    day: "day-after",
    marketCount: 3,
    bettable: false,
    markets: [oneX2(2.4, 3.0, 2.95), goals(2.05, 1.72), btts(1.85, 1.88)],
  },
  {
    id: "m10",
    sport: "Football",
    league: "Premier League",
    country: "England",
    countryCode: "GB",
    home: "Chelsea",
    away: "Everton",
    startsAt: "Wed 21:00",
    startsAtIso: null,
    day: "day-after",
    marketCount: 3,
    bettable: false,
    markets: [oneX2(1.68, 3.8, 4.8), goals(1.7, 2.1), btts(1.75, 2.0)],
  },
  {
    id: "m11",
    sport: "Football",
    league: "Ligue 1",
    country: "France",
    countryCode: "FR",
    home: "PSG",
    away: "Marseille",
    startsAt: "Tomorrow 21:00",
    startsAtIso: null,
    day: "tomorrow",
    popular: true,
    marketCount: 3,
    bettable: false,
    markets: [oneX2(1.45, 4.6, 6.0), goals(1.42, 2.75), btts(1.68, 2.1)],
  },
  {
    id: "m12",
    sport: "Basketball",
    league: "NBA",
    country: "USA",
    countryCode: "US",
    home: "LA Lakers",
    away: "Golden State Warriors",
    startsAt: "Wed 04:00",
    startsAtIso: null,
    day: "day-after",
    marketCount: 1,
    bettable: false,
    markets: [winner(2.05, 1.78)],
  },
];

/** Sport entries for the filter dropdown when the database is unreachable. */
export const demoSports = [
  { id: "football", name: "Football" },
  { id: "basketball", name: "Basketball" },
  { id: "tennis", name: "Tennis" },
  { id: "cricket", name: "Cricket" },
  { id: "rugby", name: "Rugby" },
  { id: "volleyball", name: "Volleyball" },
  { id: "esports", name: "eSports" },
  { id: "boxing", name: "Boxing" },
];

/** Market templates for the filter dropdown when the database is unreachable. */
export const demoMarketOptions = [
  { code: "MATCH_WINNER", name: "1X2" },
  { code: "OVER_UNDER", name: "Over / Under" },
  { code: "BTTS", name: "Both teams to score" },
  { code: "WINNER", name: "Winner" },
];

/** Kickoff-time filter chips ("All", "Today", ...). */
export const kickoffOptions: { id: KickoffDay | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "day-after", label: "Day after" },
  { id: "this-week", label: "This week" },
];

/** Country → leagues tree rendered in the left slide-in main menu. */
export const countriesWithLeagues = [
  { country: "Uganda", leagues: ["Uganda Premier League", "Uganda Big League"] },
  { country: "England", leagues: ["Premier League", "Championship", "FA Cup"] },
  { country: "Spain", leagues: ["La Liga", "Copa del Rey"] },
  { country: "Italy", leagues: ["Serie A", "Coppa Italia"] },
  { country: "Germany", leagues: ["Bundesliga", "DFB Pokal"] },
  { country: "France", leagues: ["Ligue 1", "Coupe de France"] },
  { country: "Africa", leagues: ["CAF Champions League", "CAF Confederation Cup"] },
  { country: "USA", leagues: ["NBA", "MLS"] },
];

/* ── Country flags ──────────────────────────────────────────────────────────
 * Emoji flags keyed by country name. TODO(integration): swap for flag
 * sprites/SVGs if the design system requires crisp icons.
 * ──────────────────────────────────────────────────────────────────────── */
export const countryFlags: Record<string, string> = {
  Uganda: "🇺🇬",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Spain: "🇪🇸",
  Italy: "🇮🇹",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Africa: "🌍",
  USA: "🇺🇸",
  Egypt: "🇪🇬",
  "South Africa": "🇿🇦",
  Kenya: "🇰🇪",
  Tanzania: "🇹🇿",
};

/** Flag lookup with a neutral fallback for unmapped countries. */
export const flagFor = (country: string) => countryFlags[country] ?? "🏳️";

/**
 * ISO-3166 / private-use country codes used by `leagues.country_code` and
 * `teams.country_code` → the country name shown in the UI.
 * 'XA' is a private-use code standing in for pan-African competitions.
 */
const countryNames: Record<string, string> = {
  UG: "Uganda",
  GB: "England",
  ES: "Spain",
  IT: "Italy",
  DE: "Germany",
  FR: "France",
  US: "USA",
  EG: "Egypt",
  ZA: "South Africa",
  KE: "Kenya",
  TZ: "Tanzania",
  XA: "Africa",
};

/** Maps a stored country code to a display name ('' when unknown). */
export const countryNameFromCode = (code: string | null | undefined): string =>
  code ? (countryNames[code.toUpperCase()] ?? "") : "";

/** Single currency formatter for the whole app — always display money via this. */
export const formatUgx = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value);
