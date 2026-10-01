// ============= Full file contents =============
/**
 * site-header.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixed top bar: main menu trigger, SMARTBET logo, search, and the account
 * area on the right.
 *
 * Account area rules (per product spec):
 * - Logged OUT  -> "Log in" + "Join now" buttons; no balance is ever shown.
 * - Logged IN with a zero/empty wallet -> a "Deposit" button instead of the
 *   balance, nudging the player to top up.
 * - Logged IN with funds -> the balance chip (authoritative, from the
 *   server-side wallet ledger). While loading it displays "—".
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { MainMenu } from "./main-menu";
import { AccountMenu } from "./account-menu";
import { SearchDialog } from "./search-dialog";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { balance, loading: walletLoading } = useWallet();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const loading = authLoading || walletLoading;
  const display = loading ? "—" : formatUgx(balance ?? 0);
  /** True only once we know the wallet is loaded and holds nothing. */
  const isEmpty = isAuthenticated && !loading && (balance ?? 0) <= 0;

  return (
    <header className="fixed inset-x-0 top-0 z-50 brand-gradient text-surface-foreground">
      {/** Forty-pixel header rail, reduced by roughly 40% from the original height. */}
      <div className="mx-auto flex h-10 w-full max-w-[968px] items-center gap-0.5 px-0.5">
        <MainMenu />
        <Link
          to="/"
          className="font-display text-lg font-bold leading-none text-surface-foreground"
        >
          SMARTBET
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <SearchDialog />

          {!isAuthenticated && !authLoading ? (
            /* ── Logged out: entry points instead of any balance ────────── */
            <>
              <Link
                to="/auth"
                className="ml-0.5 rounded-md px-1 py-0.5 text-xs font-semibold text-surface-foreground/90 transition-colors hover:text-surface-foreground"
              >
                Log in
              </Link>
              <Link
                to="/auth"
                className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground"
              >
                Join now
              </Link>
            </>
          ) : isEmpty ? (
            /* ── Logged in, empty wallet: push a deposit instead of USh 0 ── */
            <Link
              to="/deposit"
              className="ml-0.5 rounded-md bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground"
            >
              Deposit
            </Link>
          ) : (
            /* ── Logged in with funds: authoritative ledger balance ──────── */
            <Link
              to="/deposit"
              className="ml-0.5 flex items-center gap-1 rounded-md bg-surface-foreground/10 px-1 py-0.5"
            >
              <Wallet className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold tabular-nums">{display}</span>
            </Link>
          )}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
