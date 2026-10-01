/**
 * routes/auth.tsx — SIGN IN / REGISTER / PASSWORD.
 *
 * Authentication is Supabase Auth with **email + password**. Supabase stores the
 * bcrypt hash and verifies it; this page only collects the credentials and shows
 * the outcome. Nothing here touches a password hash or compares passwords itself.
 *
 * Modes:
 *   signin   → supabase.auth.signInWithPassword
 *   register → supabase.auth.signUp (+ confirmation screen when the project
 *              requires the email to be confirmed)
 *   forgot   → supabase.auth.resetPasswordForEmail
 *   reset    → shown automatically when the player returns from a reset link;
 *              calls supabase.auth.updateUser({ password })
 *
 * The profile + wallet rows and the signup details are created by the
 * `handle_new_user` trigger — see supabase/migrations/20260101000400_password_auth.sql.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MIN_PASSWORD_LENGTH, isPhoneIdentifier, useAuth } from "@/hooks/use-auth";
import { formatPhone, normalizePhone } from "@/modules/auth/phone";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or register · SMARTBET" },
      {
        name: "description",
        content:
          "Sign in to SMARTBET with your email and password, or open an account in a minute. Players must be 25+.",
      },
      { property: "og:title", content: "Sign in or register · SMARTBET" },
      {
        property: "og:description",
        content: "Access your SMARTBET account or open a new one with email and password.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "register" | "forgot" | "reset";

function AuthPage() {
  const router = useRouter();
  const {
    isAuthenticated,
    loading: authLoading,
    recovery,
    user,
    profile,
    signInWithIdentifier,
    signUp,
    sendPasswordReset,
    setPassword,
    resendConfirmation,
    signOut,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [pending, setPending] = useState(false);
  const [agree, setAgree] = useState(false);
  /** Live value of the sign-in field, so we can show how it will be read. */
  const [identifier, setIdentifier] = useState("");
  /** Set after a successful signup that still needs an email confirmation. */
  const [awaitingEmail, setAwaitingEmail] = useState<string | null>(null);

  /**
   * Detect a return from a Supabase email link and offer to set a new password.
   * Two signals, because supabase-js strips the token out of the URL hash as soon
   * as it initialises: the PASSWORD_RECOVERY auth event, and (as a fallback) the
   * URL itself. Both are read client-side only, so SSR and hydration agree.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const isRecovery =
      params.get("mode") === "reset" ||
      params.get("type") === "recovery" ||
      hash.includes("type=recovery");

    if (isRecovery) {
      setMode("reset");
      toast.message("Set a new password to finish signing in");
    }
  }, []);

  useEffect(() => {
    if (recovery) setMode("reset");
  }, [recovery]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const value = (form.elements.namedItem("login-identifier") as HTMLInputElement).value;
    const password = (form.elements.namedItem("login-pass") as HTMLInputElement).value;

    setPending(true);
    try {
      await signInWithIdentifier(value, password);
      toast.success("Signed in");
      router.navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agree) {
      toast.error("You must confirm you are 25 or older");
      return;
    }
    const form = e.currentTarget;
    const fullName = (form.elements.namedItem("reg-name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("reg-email") as HTMLInputElement).value;
    const phone = (form.elements.namedItem("reg-phone") as HTMLInputElement).value;
    const dateOfBirth = (form.elements.namedItem("reg-dob") as HTMLInputElement).value;
    const nationalId = (form.elements.namedItem("reg-national-id") as HTMLInputElement).value;
    const password = (form.elements.namedItem("reg-pass") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("reg-pass-confirm") as HTMLInputElement).value;

    if (!normalizePhone(phone)) {
      toast.error("Enter a valid phone number, e.g. 0772 000 000");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords do not match");
      return;
    }

    setPending(true);
    try {
      const out = await signUp({
        fullName,
        email,
        phone,
        dateOfBirth,
        nationalId,
        password,
        termsAccepted: agree,
      });
      if (out.needsEmailConfirmation) {
        setAwaitingEmail(out.email);
        toast.success("Account created — confirm your email to finish");
      } else {
        toast.success("Account created");
        router.navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setPending(false);
    }
  }

  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = (e.currentTarget.elements.namedItem("forgot-email") as HTMLInputElement).value;
    setPending(true);
    try {
      await sendPasswordReset(email);
      toast.success("If that email has an account, a reset link is on its way");
      setMode("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the reset email");
    } finally {
      setPending(false);
    }
  }

  async function handleNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = (form.elements.namedItem("new-pass") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("new-pass-confirm") as HTMLInputElement).value;
    if (password !== confirm) {
      toast.error("The two passwords do not match");
      return;
    }
    setPending(true);
    try {
      await setPassword(password);
      // Drop the recovery token from the URL so a refresh cannot reuse it.
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
      toast.success("Password updated — you are signed in");
      router.navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (!awaitingEmail) return;
    setPending(true);
    try {
      await resendConfirmation(awaitingEmail);
      toast.success("Confirmation email sent again");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the email");
    } finally {
      setPending(false);
    }
  }

  /* ── Already signed in ──────────────────────────────────────────────────── */
  if (!authLoading && isAuthenticated && mode !== "reset") {    const name =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      profile?.username ||
      user?.email ||
      "player";
    return (
      <main className="mx-auto max-w-md px-3 py-6">
        <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">My account</h1>
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold">Signed in as {name}</p>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate font-semibold">{profile?.email ?? user?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-semibold">{profile?.phone ? formatPhone(profile.phone) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Verification</dt>
              <dd className="font-semibold capitalize">{profile?.kyc_status ?? "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to="/transactions" className="text-xs font-bold text-accent">
              Transactions
            </Link>
            <Link to="/my-bets" className="text-xs font-bold text-accent">
              My bets
            </Link>
            <Link to="/deposit" className="text-xs font-bold text-accent">
              Deposit
            </Link>
          </div>
          <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
          <div className="space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <p>
              {profile?.phone
                ? `You can sign in with your email or with ${formatPhone(profile.phone)}.`
                : "You can sign in with your email address."}
            </p>
            <p>
              <button
                type="button"
                className="font-semibold text-accent"
                onClick={() => setMode("reset")}
              >
                Change my password
              </button>{" "}
              — you are signed in, so no email is needed.
            </p>
            <p>
              <button
                type="button"
                className="font-semibold text-accent"
                onClick={() => {
                  setMode("forgot");
                  void signOut();
                }}
              >
                Email me a reset link
              </button>{" "}
              — for when you cannot sign in at all (signs you out first).
            </p>
          </div>
        </section>
      </main>
    );
  }

  /* ── Awaiting email confirmation ────────────────────────────────────────── */
  if (awaitingEmail) {
    return (
      <main className="mx-auto max-w-md px-3 py-6">
        <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">
          Confirm email
        </h1>
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm">
            We emailed a confirmation link to <strong>{awaitingEmail}</strong>. Open it to activate
            your account, then sign in.
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={() => void handleResend()}
            disabled={pending}
          >
            {pending ? "Sending…" : "Resend confirmation email"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setAwaitingEmail(null);
              setMode("signin");
            }}
          >
            Back to sign in
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Nothing arriving? Check your spam folder — or ask an administrator, who can turn email
            confirmation off for this project.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-3 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">
        Welcome to SMARTBET
      </h1>

      {mode === "reset" ? (
        /* ── Set a new password (after a reset link) ─────────────────────── */
        <form
          className="space-y-4 rounded-lg border border-border bg-card p-4"
          onSubmit={handleNewPassword}
        >
          <div>
            <p className="font-semibold">Choose a new password</p>
            <p className="mt-1 text-sm text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pass">New password</Label>
            <Input
              id="new-pass"
              name="new-pass"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pass-confirm">Repeat password</Label>
            <Input
              id="new-pass-confirm"
              name="new-pass-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save password and continue"}
          </Button>
        </form>
      ) : mode === "forgot" ? (
        /* ── Forgot password ─────────────────────────────────────────────── */
        <form
          className="space-y-4 rounded-lg border border-border bg-card p-4"
          onSubmit={handleForgot}
        >
          <div>
            <p className="font-semibold">Reset your password</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the email address on your account and we will email you a link that brings you
              back here to set a new one. Sign in with a phone number? Use the email you registered
              with.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">Email address</Label>
            <Input
              id="forgot-email"
              name="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
          <button
            type="button"
            className="w-full text-xs font-semibold text-muted-foreground"
            onClick={() => setMode("signin")}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          {/* ── Sign in ───────────────────────────────────────────────────── */}
          <TabsContent value="signin" className="mt-4 space-y-4">
            <form
              className="space-y-4 rounded-lg border border-border bg-card p-4"
              onSubmit={handleSignIn}
            >
              <div className="space-y-1.5">
                <Label htmlFor="login-identifier">Email address or phone number</Label>
                <Input
                  id="login-identifier"
                  name="login-identifier"
                  autoComplete="username"
                  placeholder="you@example.com or 0772 000 000"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  {isPhoneIdentifier(identifier)
                    ? `Signing in with phone ${formatPhone(normalizePhone(identifier) ?? identifier)}`
                    : "Use whichever you registered with — both open the same account."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-pass">Password</Label>
                <Input
                  id="login-pass"
                  name="login-pass"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-xs font-semibold text-muted-foreground"
              >
                Forgot password?
              </button>
            </form>
          </TabsContent>

          {/* ── Register ──────────────────────────────────────────────────── */}
          <TabsContent value="register" className="mt-4 space-y-4">
            <form
              className="space-y-4 rounded-lg border border-border bg-card p-4"
              onSubmit={handleRegister}
            >
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">Full name</Label>
                <Input id="reg-name" name="reg-name" placeholder="Jane Nakato" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email address</Label>
                <Input
                  id="reg-email"
                  name="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Where confirmation and password-reset links are sent. You can sign in with this
                  address or with your phone number.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-phone">Phone number</Label>
                <Input
                  id="reg-phone"
                  name="reg-phone"
                  inputMode="tel"
                  placeholder="0772 000 000"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Also a sign-in name: after registering you can use this number or your email.
                </p>
              </div>
              {/* National ID (NIN) — required now, verified in the KYC phase. */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-national-id">National ID number</Label>
                <Input
                  id="reg-national-id"
                  name="reg-national-id"
                  placeholder="e.g. CF1234567890AB"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-dob">Date of birth</Label>
                <Input id="reg-dob" name="reg-dob" type="date" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pass">Password</Label>
                  <Input
                    id="reg-pass"
                    name="reg-pass"
                    type="password"
                    autoComplete="new-password"
                    placeholder={`${MIN_PASSWORD_LENGTH}+ characters`}
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pass-confirm">Repeat password</Label>
                  <Input
                    id="reg-pass-confirm"
                    name="reg-pass-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
                <span>
                  I am 25 years or older and accept the terms and responsible gaming policy.
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating account…" : "Create account"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Your password is stored and checked by Supabase Auth — SMARTBET never sees it.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      )}

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Betting is for players aged 25 and above. Play responsibly.
      </p>
    </main>
  );
}
