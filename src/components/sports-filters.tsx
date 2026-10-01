/**
 * sports-filters.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Filter bar for the sports page: sport / league / market dropdowns plus
 * kickoff-time chips.
 *
 * The option lists come from the DATABASE CATALOGUE (the `sports` table and the
 * `market_types` templates behind the open markets), passed in by the caller
 * from `useCatalogue()`, so the dropdowns can only ever offer values that
 * actually exist in the book. `filterMatches()` applies a SportsFilterState to a
 * fixture list.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { kickoffOptions, type Match } from "@/lib/betting-data";
import type {
  CatalogueMarketType,
  CatalogueSport,
} from "@/modules/sportsbook/catalogue.functions";

export type SportsFilterState = {
  /** Sport display name, or 'all'. */
  sport: string;
  league: string;
  /** `market_types.code`, or 'all'. */
  market: string;
  kickoff: string;
};

export const defaultFilters: SportsFilterState = {
  sport: "all",
  league: "all",
  market: "all",
  kickoff: "all",
};

export function SportsFilters({
  value,
  onChange,
  showKickoff = true,
  matches,
  sports,
  marketTypes,
}: {
  value: SportsFilterState;
  onChange: (v: SportsFilterState) => void;
  showKickoff?: boolean;
  /** Every fixture in the catalogue — used to build the league list. */
  matches: Match[];
  sports: CatalogueSport[];
  marketTypes: CatalogueMarketType[];
}) {
  const leagues = Array.from(
    new Set(
      matches
        .filter((m) => value.sport === "all" || m.sport === value.sport)
        .map((m) => m.league)
        .filter(Boolean),
    ),
  ).sort();

  return (
    <div className="space-y-3 border-b border-border bg-card px-3 py-3">
      <div className="grid grid-cols-3 gap-2.5">
        <Select
          value={value.sport}
          onValueChange={(v) => onChange({ ...value, sport: v, league: "all" })}
        >
          <SelectTrigger className="h-10 rounded-md bg-background text-xs font-medium">
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sports</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s.id} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.league} onValueChange={(v) => onChange({ ...value, league: v })}>
          <SelectTrigger className="h-10 rounded-md bg-background text-xs font-medium">
            <SelectValue placeholder="League" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leagues</SelectItem>
            {leagues.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.market} onValueChange={(v) => onChange({ ...value, market: v })}>
          <SelectTrigger className="h-10 rounded-md bg-background text-xs font-medium">
            <SelectValue placeholder="Market" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All markets</SelectItem>
            {marketTypes.map((m) => (
              <SelectItem key={m.code} value={m.code}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showKickoff && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {kickoffOptions.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => onChange({ ...value, kickoff: k.id })}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                value.kickoff === k.id
                  ? "border-odds-active bg-odds-active text-odds-active-foreground"
                  : "border-border bg-secondary text-secondary-foreground hover:border-accent/50"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Applies a SportsFilterState to a fixture list. */
export function filterMatches(all: Match[], f: SportsFilterState): Match[] {
  return all.filter((m) => {
    if (f.sport !== "all" && m.sport !== f.sport) return false;
    if (f.league !== "all" && m.league !== f.league) return false;
    if (f.kickoff !== "all" && m.day !== f.kickoff) return false;
    if (f.market !== "all" && !m.markets.some((mk) => mk.code === f.market)) return false;
    return true;
  });
}
