/**
 * catalogue.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * React context that hands the database catalogue to every screen.
 *
 * The data is loaded ONCE per page load by the root route loader
 * (src/routes/__root.tsx → getCatalogue) and rendered into the HTML on the
 * server, so the first paint already shows real fixtures and prices. Client-side
 * navigations reuse the same loader data; `refresh()` re-runs it when you want
 * fresh odds.
 *
 * Consumers: routes/index.tsx, routes/sports.tsx, routes/live.tsx,
 * routes/match.$matchId.tsx, components/match-card.tsx, search-dialog.tsx,
 * sports-filters.tsx, routes/booking-code.tsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import type { CatalogueSport, CatalogueMarketType, CataloguePayload } from "@/modules/sportsbook/catalogue.functions";
import type { Match } from "@/lib/betting-data";

type CatalogueValue = {
  matches: Match[];
  sports: CatalogueSport[];
  marketTypes: CatalogueMarketType[];
  /** 'database' when reading live Supabase rows, 'demo' when using the fallback. */
  source: CataloguePayload["source"];
  /** Explanation shown in the UI while the demo fallback is active. */
  notice: string | null;
  loading: boolean;
  /** Looks a fixture up by `events.id`. */
  byId: (matchId: string) => Match | undefined;
  /** Re-runs the catalogue loader (used after odds change / manual refresh). */
  refresh: () => void;
};

const CatalogueContext = createContext<CatalogueValue | null>(null);

export function CatalogueProvider({
  initial,
  children,
}: {
  initial: CataloguePayload;
  children: ReactNode;
}) {
  const router = useRouter();

  const refresh = useCallback(() => {
    void router.invalidate();
  }, [router]);

  const value = useMemo<CatalogueValue>(() => {
    const index = new Map(initial.matches.map((m) => [m.id, m]));
    return {
      matches: initial.matches,
      sports: initial.sports,
      marketTypes: initial.marketTypes,
      source: initial.source,
      notice: initial.notice,
      loading: false,
      byId: (matchId: string) => index.get(matchId),
      refresh,
    };
  }, [initial, refresh]);

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

/** Reads the catalogue. Must be used under <CatalogueProvider>. */
export function useCatalogue(): CatalogueValue {
  const ctx = useContext(CatalogueContext);
  if (!ctx) throw new Error("useCatalogue must be used inside CatalogueProvider");
  return ctx;
}
