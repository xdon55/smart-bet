/**
 * hooks/use-auth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The app's authentication surface. Everything credential-related is delegated
 * to **Supabase Auth** (email + password):
 *
 *   signUp()            → supabase.auth.signUp({ email, password, options.data })
 *   signIn()            → supabase.auth.signInWithPassword({ email, password })
 *   sendPasswordReset() → supabase.auth.resetPasswordForEmail(email)
 *   setPassword()       → supabase.auth.updateUser({ password })
 *   signOut()           → supabase.auth.signOut()
 *
 * Supabase (GoTrue) hashes the password with bcrypt, verifies it on sign-in and
 * issues the JWT session that this app then sends as a bearer token to every
 * server function. No password ever passes through our own tables or server code.
 *
 * Registration details (name, phone, date of birth, National ID, terms) travel as
 * auth metadata; the `handle_new_user` trigger copies them into `profiles` and
 * creates the UGX wallet.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserProfile, type UserProfile } from "@/modules/auth/auth.functions";
import { resolvePhoneLogin } from "@/modules/auth/phone-login.functions";
import { normalizePhone } from "@/modules/auth/phone";

/** Minimum password length enforced here as well as in Supabase's settings. */
export const MIN_PASSWORD_LENGTH = 8;

export type SignUpInput = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  nationalId: string;
  password: string;
  termsAccepted: boolean;
};

export type SignUpOutcome = {
  /** True when Supabase requires the player to click the confirmation email. */
  needsEmailConfirmation: boolean;
  email: string;
};

/** Turns Supabase Auth errors into messages a player can act on. */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email or password is incorrect";
  if (m.includes("email not confirmed")) {
    return "Confirm your email address first — open the link we emailed you";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "That email already has an account — sign in instead";
  }
  if (m.includes("password should be at least") || m.includes("password is too short")) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many attempts — please wait a minute and try again";
  }
  if (m.includes("for security purposes") || m.includes("only request this after")) {
    return "Please wait a moment before requesting another email";
  }
  if (
    m.includes("unable to validate email") ||
    m.includes("invalid email") ||
    m.includes("invalid format")
  ) {
    return "Enter a valid email address";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "New registrations are currently disabled on this project";
  }
  if (m.includes("auth session missing")) return "Sign in to continue";
  return raw || "Something went wrong — please try again";
}

/** Where Supabase should send confirmation / recovery links back to. */
function authRedirectUrl(): string | undefined {
  return typeof window === "undefined" ? undefined : `${window.location.origin}/auth`;
}

/**
 * True when a sign-in identifier is a phone number rather than an email address.
 * Anything with an "@" is treated as an email; otherwise it is a phone number.
 */
export function isPhoneIdentifier(identifier: string): boolean {
  const value = identifier.trim();
  if (!value || value.includes("@")) return false;
  return normalizePhone(value) !== null;
}

export function useAuth() {
  const fetchProfile = useServerFn(getCurrentUserProfile);
  const resolvePhone = useServerFn(resolvePhoneLogin);
  const [user, setUser] = useState<null | { id: string; email: string | undefined }>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * True while the session came from a password-reset link. supabase-js strips
   * the token out of the URL hash as soon as it loads, so this event — not the
   * URL — is the reliable signal that the player must choose a new password.
   */
  const [recovery, setRecovery] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const p = await fetchProfile();
      setProfile(p);
      return p;
    } catch (e) {
      console.error("Failed to load profile", e);
      return null;
    }
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        await loadProfile();
      } else {
        setUser(null);
        setProfile(null);
      }
      if (mounted) setLoading(false);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (
        (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") &&
        session?.user
      ) {
        setUser({ id: session.user.id, email: session.user.email });
        void loadProfile();
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setRecovery(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  /** Email + password sign-in, verified by Supabase. */
  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error(authErrorMessage(error));
      if (data.user) setUser({ id: data.user.id, email: data.user.email });
      await loadProfile();
    },
    [loadProfile],
  );

  /**
   * Sign in with EITHER an email address OR a registered phone number.
   *
   * An email goes straight to Supabase. A phone number is first resolved to the
   * account's email by `resolvePhoneLogin` (which verifies the typed password
   * against GoTrue's bcrypt hash and refuses to reveal anything otherwise); the
   * browser then signs in with that email, so GoTrue checks the password itself
   * and issues the session exactly as it does for email sign-in.
   */
  const signInWithIdentifier = useCallback(
    async (identifier: string, password: string) => {
      const value = identifier.trim();
      if (!value) throw new Error("Enter your email address or phone number");

      if (!isPhoneIdentifier(value)) {
        await signIn(value, password);
        return;
      }

      const resolved = (await resolvePhone({ data: { phone: value, password } })) as {
        email: string;
      };
      await signIn(resolved.email, password);
    },
    [signIn, resolvePhone],
  );

  /**
   * Create an account. When the project has "Confirm email" enabled Supabase
   * emails a link and there is no session yet, so the caller must tell the
   * player to open it.
   */
  const signUp = useCallback(
    async (input: SignUpInput): Promise<SignUpOutcome> => {
      const email = input.email.trim().toLowerCase();
      const phone = normalizePhone(input.phone);
      if (!phone) throw new Error("Enter a valid phone number, e.g. 0772 000 000");
      if (input.password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      if (!input.termsAccepted) {
        throw new Error("Confirm you are 25 or older and accept the terms");
      }

      const redirectTo = authRedirectUrl();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
          data: {
            display_name: input.fullName.trim(),
            full_name: input.fullName.trim(),
            phone,
            date_of_birth: input.dateOfBirth || null,
            national_id: input.nationalId.trim(),
            country_code: "UG",
            contact_email: email,
            terms_accepted: true,
          },
        },
      });
      if (error) throw new Error(authErrorMessage(error));

      // With "Confirm email" on, Supabase returns an obfuscated user with no
      // identities when the address is already registered.
      if (data.user?.identities && data.user.identities.length === 0) {
        throw new Error("That email already has an account — sign in instead");
      }

      const needsEmailConfirmation = !data.session;
      if (data.session?.user) {
        setUser({ id: data.session.user.id, email: data.session.user.email });
        await loadProfile();
      }
      return { needsEmailConfirmation, email };
    },
    [loadProfile],
  );

  /** Re-sends the signup confirmation email. */
  const resendConfirmation = useCallback(async (email: string) => {
    const redirectTo = authRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
    });
    if (error) throw new Error(authErrorMessage(error));
  }, []);

  /** Emails a password-reset link that returns to /auth. */
  const sendPasswordReset = useCallback(async (email: string) => {
    const redirectTo = authRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) throw new Error(authErrorMessage(error));
  }, []);

  /**
   * Sets a new password for the current session — used after a reset link (the
   * recovery session) and for a voluntary password change while signed in.
   */
  const setPassword = useCallback(async (password: string) => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(authErrorMessage(error));
    // The new password is live: leave the recovery flow behind.
    setRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    /** True while the player must choose a new password after a reset link. */
    recovery,
    signIn,
    /** Email *or* phone number + password. */
    signInWithIdentifier,
    signUp,
    resendConfirmation,
    sendPasswordReset,
    setPassword,
    signOut,
    refreshProfile: loadProfile,
  };
}
