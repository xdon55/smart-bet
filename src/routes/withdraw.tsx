/**
 * routes/withdraw.tsx — WITHDRAW page.
 *
 * Presents amount selection and mobile-money style payout options in UGX.
 * The request goes to `requestWithdrawal`, which stores a masked payout method
 * on `payment_methods` and calls the database function `request_withdrawal`:
 * the money leaves the wallet immediately and is refunded automatically if
 * staff reject the request (`reject_withdrawal`). KYC must be verified first —
 * the database refuses the request otherwise.
 */
import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";
import { requestWithdrawal } from "@/modules/wallet/wallet.functions";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw · SMARTBET" },
      {
        name: "description",
        content: "Cash out your SMARTBET winnings to MTN MoMo or Airtel Money in minutes.",
      },
      { property: "og:title", content: "Withdraw · SMARTBET" },
      { property: "og:description", content: "Fast payouts to mobile money in UGX." },
    ],
  }),
  component: WithdrawRoute,
});

/** Withdrawals need a verified account, so the page sits behind the auth gate. */
function WithdrawRoute() {
  return (
    <RequireAuth
      title="Sign in to withdraw"
      description="Sign in to request a payout to your mobile money account."
    >
      <WithdrawPage />
    </RequireAuth>
  );
}

/** UI option → the `provider` string stored on the withdrawal. */
const methods = [
  { id: "mtn_momo", name: "MTN MoMo", note: "Payout in 2-5 minutes" },
  { id: "airtel_money", name: "Airtel Money", note: "Payout in 2-5 minutes" },
];

/** Keeps only the last three digits visible: '+256 7** *** 123'. */
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return value.trim();
  return `${digits.slice(0, 3)}*****${digits.slice(-3)}`;
}

function WithdrawPage() {
  const router = useRouter();
  const { balance, loading, refresh } = useWallet();
  const [method, setMethod] = useState("mtn_momo");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(10000);
  const [pending, setPending] = useState(false);
  // No platform fee at launch. Provider charges, when they exist, are recorded
  // in `withdrawals.fee` by the payment integration.
  const fee = 0;
  const available = balance ?? 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amount > available) {
      toast.error("Insufficient balance");
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      toast.error("Enter a valid payout phone number");
      return;
    }
    setPending(true);
    try {
      await (requestWithdrawal as any)({
        data: { amount, provider: method, destination: maskPhone(phone) },
      });
      toast.success(`Withdrawal of ${formatUgx(amount)} requested`);
      refresh();
      router.navigate({ to: "/transactions" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-3 py-6">
      <h1 className="mb-1 font-display text-2xl font-bold uppercase tracking-wide">Withdraw</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Withdrawable balance {loading ? "—" : formatUgx(available)}
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
          <Label htmlFor="wd-phone">Phone number</Label>
          <Input
            id="wd-phone"
            inputMode="tel"
            placeholder="0772 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wd-amount">Amount (UGX)</Label>
          <Input
            id="wd-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </div>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Platform fee</dt>
            <dd className="font-semibold tabular-nums">{formatUgx(fee)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">You receive</dt>
            <dd className="font-semibold tabular-nums">{formatUgx(Math.max(amount - fee, 0))}</dd>
          </div>
        </dl>
        <Button
          type="submit"
          className="w-full"
          disabled={pending || amount < 5000 || amount > available}
        >
          Withdraw {formatUgx(amount)}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Minimum withdrawal UGX 5,000. No platform fee at launch. Your identity must be verified
          before a payout is released.
        </p>
      </form>
    </main>
  );
}
