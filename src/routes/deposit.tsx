/**
 * routes/deposit.tsx — DEPOSIT page.
 *
 * Presents amount selection and mobile-money style payment options in UGX.
 * The request is sent to `createDeposit`, which opens a `deposits` row and
 * settles it through the ledger (`complete_deposit` → `post_ledger_entry`).
 * Until MTN/Airtel/card providers are connected this runs in "manual" mode,
 * controlled by the `manual_deposits_enabled` app setting — see
 * supabase/migrations/20260101000100_smartbet_app_support.sql. Once a provider
 * webhook is live it calls `complete_deposit` directly and this page follows.
 */
import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";
import { createDeposit } from "@/modules/wallet/wallet.functions";
import { RequireAuth } from "@/components/require-auth";


export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: "Deposit · SMARTBET" },
      {
        name: "description",
        content: "Top up your SMARTBET wallet instantly with MTN MoMo, Airtel Money or bank card in UGX.",
      },
      { property: "og:title", content: "Deposit · SMARTBET" },
      { property: "og:description", content: "Instant deposits with mobile money or card in UGX." },
    ],
  }),
  component: DepositRoute,
});

/** Deposits need an account, so the page sits behind the auth gate. */
function DepositRoute() {
  return (
    <RequireAuth
      title="Sign in to deposit"
      description="Sign in to your SMARTBET account to top up the wallet in UGX."
    >
      <DepositPage />
    </RequireAuth>
  );
}

/** UI option → the `provider` string stored on the deposit row. */
const methods = [
  { id: "mtn_momo", name: "MTN MoMo", note: "Instant · no fees" },
  { id: "airtel_money", name: "Airtel Money", note: "Instant · no fees" },
  { id: "card", name: "Bank card", note: "Visa / Mastercard" },
];

const quick = [5000, 10000, 20000, 50000, 100000];

function DepositPage() {
  const router = useRouter();
  const { balance, loading, refresh } = useWallet();
  const [method, setMethod] = useState("mtn_momo");
  const [amount, setAmount] = useState(10000);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amount < 1000) {
      toast.error("Minimum deposit is UGX 1,000");
      return;
    }
    setPending(true);
    try {
      const result = await (createDeposit as any)({ data: { amount, provider: method } });
      toast.success(`Wallet credited with ${formatUgx(result.credited)}`);
      refresh();
      router.navigate({ to: "/transactions" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setPending(false);
    }
  }

  return (

    <main className="mx-auto max-w-md px-3 py-6">
      <h1 className="mb-1 font-display text-2xl font-bold uppercase tracking-wide">Deposit</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Balance {loading ? "—" : formatUgx(balance ?? 0)}
      </p>

      <div className="space-y-2">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
              method === m.id ? "border-accent bg-accent/10" : "border-border bg-card"
            }`}
          >
            <span>
              <span className="block text-sm font-semibold">{m.name}</span>
              <span className="block text-xs text-muted-foreground">{m.note}</span>
            </span>
            <span
              className={`h-4 w-4 rounded-full border-2 ${method === m.id ? "border-accent bg-accent" : "border-muted-foreground"}`}
            />
          </button>
        ))}
      </div>

      <form className="mt-4 space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="dep-phone">Phone number</Label>
          <Input id="dep-phone" inputMode="tel" placeholder="0772 000 000" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dep-amount">Amount (UGX)</Label>
          <Input
            id="dep-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(q)}
              className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground"
            >
              +{q.toLocaleString()}
            </button>
          ))}
        </div>
        <Button type="submit" className="w-full" disabled={pending || amount < 1000}>
          {pending ? "Processing..." : `Deposit ${formatUgx(amount)}`}
        </Button>
        <p className="text-[11px] text-muted-foreground">

          Minimum deposit UGX 1,000. You will receive a prompt on your phone to approve.
        </p>
      </form>
    </main>
  );
}
