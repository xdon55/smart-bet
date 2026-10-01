/**
 * routes/booking-code.tsx — BOOKING CODES.
 *
 * Two directions, both backed by the database
 * (supabase/migrations/20260101000300_booking_codes.sql):
 *
 *   LOAD   anyone can type a code (no account needed) → load_booking_code()
 *          returns the legs with the CURRENT price plus an `is_available` flag
 *          computed with the same rules place_bet() uses. Available legs replace
 *          the bet slip; closed legs are reported, never silently dropped.
 *
 *   SHARE  a signed-in player saves the current slip as a code
 *          (create_booking_code(), which re-reads every price), and can list,
 *          copy or revoke their own codes.
 */
import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Ticket, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { selectionFromCodeLeg, useBetSlip } from "@/lib/betslip";
import { useAuth } from "@/hooks/use-auth";
import { formatUgx } from "@/lib/betting-data";
import {
  deleteBookingCode,
  getMyBookingCodes,
  loadBookingCode,
  type BookingCodeSlip,
  type BookingCodeSummary,
} from "@/modules/sportsbook/booking-code.functions";

export const Route = createFileRoute("/booking-code")({
  head: () => ({
    meta: [
      { title: "Booking code · SMARTBET" },
      {
        name: "description",
        content: "Load a SMARTBET booking code to your bet slip, or share your own code with friends.",
      },
      { property: "og:title", content: "Booking code · SMARTBET" },
      { property: "og:description", content: "Load or share a SMARTBET booking code in seconds." },
    ],
  }),
  component: BookingCodePage,
});

/** "12 Mar" — codes live for 7 days by default. */
function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function BookingCodePage() {
  const { isAuthenticated } = useAuth();
  const { selections, totalOdds, stake, replace, createCode, creatingCode } = useBetSlip();

  const fetchCode = useServerFn(loadBookingCode);
  const fetchMine = useServerFn(getMyBookingCodes);
  const revokeCode = useServerFn(deleteBookingCode);

  const [code, setCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [loaded, setLoaded] = useState<BookingCodeSlip | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [mine, setMine] = useState<BookingCodeSummary[]>([]);

  const refreshMine = useCallback(async () => {
    if (!isAuthenticated) {
      setMine([]);
      return;
    }
    try {
      setMine((await (fetchMine as any)()) as BookingCodeSummary[]);
    } catch (e) {
      console.error("Could not load your booking codes", e);
    }
  }, [isAuthenticated, fetchMine]);

  useEffect(() => {
    void refreshMine();
  }, [refreshMine]);

  /** Pulls a code into the slip. `raw` lets the "your codes" list reuse this. */
  const load = useCallback(
    async (raw?: string) => {
      const entered = (raw ?? code).trim().toUpperCase();
      if (entered.length < 4) {
        toast.error("Enter a valid booking code");
        return;
      }
      setLoadingCode(true);
      try {
        const slip = (await (fetchCode as any)({ data: { code: entered } })) as BookingCodeSlip;
        const available = slip.legs.filter((l) => l.available);
        const skipped = slip.legs.length - available.length;

        // The code's legs define the slip; its stake only seeds the stake box.
        replace(
          available.map(selectionFromCodeLeg),
          slip.stake == null ? undefined : slip.stake,
        );
        setLoaded(slip);
        setCode(slip.code);

        if (!available.length) {
          toast.error("Every selection on that code has closed or already started");
        } else if (skipped > 0) {
          toast.warning(
            `Loaded ${available.length} of ${slip.legs.length} selections — ${skipped} are no longer available`,
          );
        } else {
          toast.success(`Booking code ${slip.code} loaded to your bet slip`);
        }
      } catch (e) {
        setLoaded(null);
        toast.error(e instanceof Error ? e.message : "Could not load that booking code");
      } finally {
        setLoadingCode(false);
      }
    },
    [code, fetchCode, replace],
  );

  /** Saves the current slip as a shareable code. */
  const share = useCallback(async () => {
    try {
      const created = await createCode();
      setCreatedCode(created.code);
      navigator.clipboard?.writeText(created.code);
      toast.success(`Booking code ${created.code} created and copied`);
      void refreshMine();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create a booking code");
    }
  }, [createCode, refreshMine]);

  const revoke = useCallback(
    async (target: string) => {
      try {
        await (revokeCode as any)({ data: { code: target } });
        if (createdCode === target) setCreatedCode(null);
        if (loaded?.code === target) setLoaded(null);
        toast.success(`Booking code ${target} revoked`);
        void refreshMine();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not revoke that code");
      }
    },
    [revokeCode, refreshMine, createdCode, loaded],
  );

  /** Copies a code to the clipboard with a toast. */
  const copy = (value: string) => {
    navigator.clipboard?.writeText(value);
    toast.success("Booking code copied");
  };

  return (
    <main className="mx-auto max-w-md px-3 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">Booking code</h1>

      {/* ── Load a shared code ───────────────────────────────────────────── */}
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Label htmlFor="code">Load a code</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7QM23XB"
            className="uppercase tracking-widest"
            maxLength={16}
          />
          <Button type="button" onClick={() => void load()} disabled={loadingCode}>
            {loadingCode ? "Loading…" : "Load"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Codes expire 7 days after they are created. Selections that have already closed are
          skipped, and every price is refreshed to the current one.
        </p>

        {loaded && (
          <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="font-mono tracking-widest">{loaded.code}</span>
              <span className="text-muted-foreground">
                {loaded.legs.length} selection{loaded.legs.length === 1 ? "" : "s"} · expires{" "}
                {shortDate(loaded.expiresAt)}
              </span>
            </div>
            <ul className="space-y-1">
              {loaded.legs.map((leg) => (
                <li
                  key={leg.selectionId}
                  className="flex items-start justify-between gap-2 text-[11px]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{leg.eventName}</span>
                    <span className="block truncate text-muted-foreground">
                      {leg.marketName} · {leg.selectionName}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block font-bold tabular-nums ${leg.available ? "" : "line-through opacity-60"}`}
                    >
                      {leg.odds.toFixed(2)}
                    </span>
                    {!leg.available ? (
                      <span className="block text-[10px] font-semibold text-muted-foreground">
                        not available
                      </span>
                    ) : leg.odds !== leg.oddsAtCreation ? (
                      <span className="block text-[10px] text-muted-foreground">
                        was {leg.oddsAtCreation.toFixed(2)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Share your slip ─────────────────────────────────────────────── */}
      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Share your slip
        </p>

        {createdCode ? (
          <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2.5">
            <span className="flex items-center gap-2 font-display text-lg font-bold tracking-widest">
              <Ticket className="h-4 w-4" />
              {createdCode}
            </span>
            <button
              type="button"
              onClick={() => copy(createdCode)}
              className="inline-flex items-center gap-1 text-xs font-bold uppercase"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        ) : (
          <Button
            type="button"
            className="w-full"
            onClick={() => void share()}
            disabled={creatingCode || !selections.length}
          >
            {creatingCode ? "Creating…" : "Create a code from my slip"}
          </Button>
        )}

        {!isAuthenticated && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Loading a code works without an account. Creating one needs a signed-in account.
          </p>
        )}

        <dl className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Selections in slip</dt>
            <dd className="font-semibold tabular-nums">{selections.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total odds</dt>
            <dd className="font-semibold tabular-nums">
              {selections.length ? totalOdds.toFixed(2) : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Stake</dt>
            <dd className="font-semibold tabular-nums">{formatUgx(stake)}</dd>
          </div>
        </dl>
      </section>

      {/* ── Your codes ──────────────────────────────────────────────────── */}
      {isAuthenticated && (
        <section className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Your recent codes
          </p>

          {mine.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              You have not created a booking code yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {mine.map((c) => (
                <li key={c.code} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold tracking-widest">
                      {c.code}
                      {c.expired && (
                        <span className="ml-2 font-sans text-[10px] font-semibold uppercase text-muted-foreground">
                          expired
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.legCount} selection{c.legCount === 1 ? "" : "s"} · @ {c.totalOdds.toFixed(2)}
                      {c.stake ? ` · ${formatUgx(c.stake)}` : ""} · {c.loadCount} load
                      {c.loadCount === 1 ? "" : "s"} · expires {shortDate(c.expiresAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void load(c.code)}
                    className="shrink-0 text-[11px] font-bold uppercase text-accent"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    aria-label={`Copy ${c.code}`}
                    onClick={() => copy(c.code)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Revoke ${c.code}`}
                    onClick={() => void revoke(c.code)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Revoking deletes a code immediately: nobody can load it any more.
          </p>
        </section>
      )}
    </main>
  );
}
