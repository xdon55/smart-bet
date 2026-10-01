/**
 * betslip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GLOBAL BET SLIP STATE (React context).
 *
 * Flow:
 *   MatchCard / detail page → toggle(toSelection(match, market, outcome))
 *     → BetSlip UI → placeBet() → place_bet(p_stake, p_selection_ids)
 *
 * BETS ARE REAL AND DATABASE-BACKED:
 * - `placeBet()` calls `placeBetOnServer` with the selected `selections.id`
 *   values and the stake. The server re-reads every price inside the database
 *   function `place_bet`, checks the wallet and debits the stake through the
 *   append-only ledger. Displayed odds are indicative only.
 * - `bets` (My Bets) is loaded from `bets` + `bet_legs` for the signed-in user.
 * - A selection is only bettable when it carries a real database id
 *   (`bettable: true`). Demo-fallback prices (catalogue offline) are refused here
 *   so the player never gets a "selection is not available" surprise.
 * - One pick per EVENT: `place_bet` refuses an accumulator that contains two
 *   selections from the same event, so adding a pick from another market on the
 *   same event replaces the previous one.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyBets,
  placeBetOnServer,
  type ServerBet,
} from "@/modules/sportsbook/betting.functions";
import {
  createBookingCode,
  type BookingCodeLeg,
  type CreateBookingCodeResult,
} from "@/modules/sportsbook/booking-code.functions";
import type { Market, Match, Outcome } from "@/lib/betting-data";
import { useAuth } from "@/hooks/use-auth";

/** One leg on the slip. `id` must be unique per event+market+outcome. */
export type Selection = {
  /** Slip de-dupe key: `${eventId}:${marketId}:${outcomeId}`. */
  id: string;
  /** `selections.id` — the only identifier the database needs. */
  selectionId: string;
  matchId: string;
  match: string; // display name, e.g. "Arsenal vs Liverpool"
  market: string; // display name, e.g. "1X2"
  pick: string; // display label, e.g. "Home"
  odds: number;
  /** False when the price comes from the offline demo catalogue. */
  bettable: boolean;
};

/** Every status a placed bet can carry (schema enum `bet_status`). */
export type PlacedBetStatus = "open" | "won" | "lost" | "void" | "cashed_out" | "cancelled";

/** A submitted bet ("receipt") shown on the My Bets pages. */
export type PlacedBet = {
  id: string;
  code: string; // booking-style reference shown to the user
  placedAt: string;
  stake: number; // UGX
  totalOdds: number; // combined accumulator odds
  potential: number; // potential payout in UGX
  payout: number; // settled payout in UGX (0 while open)
  status: PlacedBetStatus;
  selections: Selection[];
};

/** Everything the context exposes to consumers via useBetSlip(). */
type BetSlipContextValue = {
  selections: Selection[];
  stake: number;
  setStake: (v: number) => void;
  toggle: (s: Selection) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Replaces the whole slip — used when a booking code is loaded. */
  replace: (next: Selection[], stake?: number) => void;
  has: (id: string) => boolean;
  totalOdds: number;
  potentialWin: number;
  open: boolean; // mobile fullscreen slip visibility
  setOpen: (v: boolean) => void;
  bets: PlacedBet[];
  betsLoading: boolean;
  refreshBets: () => void;
  placing: boolean;
  /** Places the slip on the server. Throws with a human-readable message. */
  placeBet: () => Promise<PlacedBet | null>;
  creatingCode: boolean;
  /** Saves the slip as a shareable booking code. Throws with a message. */
  createCode: () => Promise<CreateBookingCodeResult>;
};

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

/** Builds a slip leg from a catalogue fixture/market/price. */
export function toSelection(match: Match, market: Market, outcome: Outcome): Selection {
  return {
    id: `${match.id}:${market.id}:${outcome.id}`,
    selectionId: outcome.id,
    matchId: match.id,
    match: `${match.home} vs ${match.away}`,
    market: market.name,
    pick: outcome.label,
    odds: outcome.odds,
    bettable: outcome.bettable !== false && match.bettable !== false,
  };
}

/**
 * Builds a slip leg from a leg returned by `load_booking_code`.
 * The price is the CURRENT one (a booking code never rewrites the book); the
 * slip shows the same price the database will use at placement.
 */
export function selectionFromCodeLeg(leg: BookingCodeLeg): Selection {
  return {
    id: `${leg.eventId}:${leg.marketId}:${leg.selectionId}`,
    selectionId: leg.selectionId,
    matchId: leg.eventId,
    match: leg.eventName,
    market: leg.marketName,
    pick: leg.selectionName,
    odds: leg.odds,
    bettable: leg.available,
  };
}

/** Maps a stored server bet into the receipt shape the My Bets screens render. */
function toPlacedBet(b: ServerBet): PlacedBet {
  const status: PlacedBetStatus =
    b.status === "pending"
      ? "open"
      : b.status === "won" || b.status === "lost"
        ? b.status
        : (b.status as PlacedBetStatus);

  return {
    id: b.id,
    code: b.code,
    placedAt: new Date(b.placedAt).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    stake: b.stake,
    totalOdds: b.totalOdds,
    potential: b.payout > 0 ? b.payout : b.potentialPayout,
    payout: b.payout,
    status,
    selections: b.selections.map((l) => ({
      id: `${l.eventId}:${l.marketId}:${l.selectionId}`,
      selectionId: l.selectionId,
      matchId: l.eventId,
      match: l.eventName,
      market: l.marketName,
      pick: l.selectionName,
      odds: l.odds,
      bettable: true,
    })),
  };
}

/** Provider mounted once in src/routes/__root.tsx around the whole app. */
export function BetSlipProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const submitBet = useServerFn(placeBetOnServer);
  const fetchBets = useServerFn(getMyBets);
  const submitCode = useServerFn(createBookingCode);

  const [selections, setSelections] = useState<Selection[]>([]);
  const [stake, setStake] = useState(2000); // default stake in UGX
  const [open, setOpen] = useState(false);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [betsKey, setBetsKey] = useState(0);

  const refreshBets = useCallback(() => setBetsKey((k) => k + 1), []);

  /* Load the signed-in player's real bet history. Signed-out users see none. */
  useEffect(() => {
    let mounted = true;
    if (!isAuthenticated) {
      setBets([]);
      return;
    }
    setBetsLoading(true);
    fetchBets()
      .then((rows) => {
        if (mounted) setBets((rows as ServerBet[]).map(toPlacedBet));
      })
      .catch((e) => console.error("Failed to load bets", e))
      .finally(() => {
        if (mounted) setBetsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user?.id, betsKey, fetchBets]);

  /**
   * Add/remove a selection. Tapping the same odds button again removes it;
   * tapping any other price on the same event swaps the previous pick out
   * (the database rejects two selections from one event in an accumulator).
   */
  const toggle = useCallback((s: Selection) => {
    setSelections((prev) => {
      if (prev.some((p) => p.id === s.id)) return prev.filter((p) => p.id !== s.id);
      return [...prev.filter((p) => p.matchId !== s.matchId), s];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSelections((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setSelections([]), []);

  /**
   * Replaces the slip wholesale — used when a booking code is loaded, where the
   * code's legs (not the player's previous picks) define the slip.
   */
  const replace = useCallback((next: Selection[], nextStake?: number) => {
    setSelections(next);
    if (nextStake != null && nextStake > 0) setStake(Math.round(nextStake));
  }, []);

  // Indicative accumulator odds for display; the server re-prices on placement.
  const totalOdds = useMemo(
    () => selections.reduce((acc, s) => acc * s.odds, 1),
    [selections],
  );

  const potentialWin = selections.length ? Math.round(stake * totalOdds) : 0;

  /**
   * Submits the current slip to the server. The server validates the account,
   * stake, selections and funds, then writes the bet + ledger atomically.
   * Throws an Error with a readable message the UI shows as a toast.
   */
  const placeBet = useCallback(async () => {
    if (!selections.length) return null;
    if (!isAuthenticated) throw new Error("Sign in to place a bet");
    if (selections.some((s) => !s.bettable)) {
      throw new Error(
        "These are demo prices — the live catalogue is unavailable, so the bet cannot be placed",
      );
    }

    setPlacing(true);
    try {
      const bet = (await submitBet({
        data: { stake, selectionIds: selections.map((s) => s.selectionId) },
      })) as ServerBet;

      const placed = toPlacedBet(bet);
      setBets((prev) => [placed, ...prev]);
      setSelections([]); // empty the slip after placing
      setOpen(false); // close the mobile fullscreen slip
      return placed;
    } finally {
      setPlacing(false);
    }
  }, [selections, stake, isAuthenticated, submitBet]);

  /**
   * Saves the current slip as a booking code and returns it so the UI can show
   * and copy it. The database re-reads every price and stores the legs; the code
   * is then loadable by anyone through /booking-code.
   */
  const createCode = useCallback(async (): Promise<CreateBookingCodeResult> => {
    if (!selections.length) throw new Error("Add selections to your slip first");
    if (!isAuthenticated) throw new Error("Sign in to create a booking code");
    if (selections.some((s) => !s.bettable)) {
      throw new Error("These are demo prices — a booking code needs live selections");
    }

    setCreatingCode(true);
    try {
      return (await submitCode({
        data: { stake, selectionIds: selections.map((s) => s.selectionId) },
      })) as CreateBookingCodeResult;
    } finally {
      setCreatingCode(false);
    }
  }, [selections, stake, isAuthenticated, submitCode]);

  const value: BetSlipContextValue = {
    selections,
    stake,
    setStake,
    toggle,
    remove,
    clear,
    replace,
    has: (id) => selections.some((s) => s.id === id),
    totalOdds,
    potentialWin,
    open,
    setOpen,
    bets,
    betsLoading,
    refreshBets,
    placing,
    placeBet,
    creatingCode,
    createCode,
  };

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

/** Hook for all bet slip reads/writes. Must be used under BetSlipProvider. */
export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used inside BetSlipProvider");
  return ctx;
}
