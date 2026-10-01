/**
 * routes/transactions.tsx — TRANSACTIONS page.
 *
 * Lists every wallet movement for the signed-in user straight from the
 * append-only `ledger_entries` table: deposits, withdrawals (and reversals),
 * bet stakes, winnings, refunds and staff adjustments.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  Gift,
  Receipt,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions · SMARTBET" },
      {
        name: "description",
        content: "Review your SMARTBET deposits, withdrawals and bet stakes with running balances in UGX.",
      },
      { property: "og:title", content: "Transactions · SMARTBET" },
      { property: "og:description", content: "Every deposit, withdrawal and stake in one place." },
    ],
  }),
  component: TransactionsRoute,
});

/** Ledger history is private, so the page sits behind the auth gate. */
function TransactionsRoute() {
  return (
    <RequireAuth
      title="Sign in for transactions"
      description="Sign in to review your deposits, withdrawals and bet stakes."
    >
      <TransactionsPage />
    </RequireAuth>
  );
}

/** Icon per `ledger_tx_type`. */
const icons = {
  deposit: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  withdrawal_reversal: RotateCcw,
  bet_stake: Receipt,
  bet_win: Receipt,
  bet_refund: RotateCcw,
  bet_cashout: Receipt,
  bonus_credit: Gift,
  bonus_reversal: Ban,
  fee: Settings2,
  adjustment: Settings2,
  chargeback: Ban,
} as const;

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelFor(tx: { type: string; reference: string | null }) {
  const names: Record<string, string> = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    withdrawal_reversal: "Withdrawal reversed",
    bet_stake: "Bet stake",
    bet_win: "Bet won",
    bet_refund: "Bet refund",
    bet_cashout: "Bet cashed out",
    bonus_credit: "Bonus credited",
    bonus_reversal: "Bonus reversed",
    fee: "Fee",
    adjustment: "Adjustment",
    chargeback: "Chargeback",
  };
  const name = names[tx.type] ?? tx.type;
  return tx.reference ? `${name} · ${tx.reference}` : name;
}

function TransactionsPage() {
  const { transactions, loading } = useWallet();

  return (
    <main className="mx-auto max-w-2xl px-3 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">Transactions</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading transactions…</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {transactions.map((tx) => {
            const Icon = icons[tx.type as keyof typeof icons] ?? Receipt;
            const isCredit = tx.direction === "credit";
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 border-b border-border bg-card px-3 py-3 last:border-b-0"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{labelFor(tx)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatWhen(tx.created_at)} · balance {formatUgx(tx.balanceAfter)}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold tabular-nums ${isCredit ? "text-accent" : "text-foreground"}`}
                >
                  {isCredit ? "+" : "-"}
                  {formatUgx(tx.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
