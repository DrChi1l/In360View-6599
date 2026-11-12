import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const env = import.meta.env as Record<string, string | undefined>;

/**
 * Supabase Auth in the browser. The publishable key is meant to be public: it identifies the
 * project, and what a signed-in person can do is decided by the website's server, which checks
 * their access token on every request. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
 * (they are read when the site is built).
 */
export const supabase = createClient(
  env.VITE_SUPABASE_URL ?? "https://not-configured.invalid",
  env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "not-configured",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
);

export const authConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);

type AuthResult = { error: { message: string; status?: number } | null; needsEmailConfirmation?: boolean };

function friendly(message: string, status?: number): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (m.includes("email not confirmed")) return "Confirm your email address first, then sign in.";
  if (m.includes("password should be at least")) return "Use a password of at least 8 characters.";
  if (m.includes("rate limit") || status === 429) return "Too many attempts. Please wait a minute and try again.";
  return message;
}

function notConfigured(): AuthResult {
  return { error: { message: "Sign-in is not set up on this site yet.", status: 503 } };
}

/**
 * Small adapter so the rest of the app keeps one simple surface:
 * `useSession()`, `signIn.email()`, `signUp.email()`, `signOut()`.
 */
export const authClient = {
  /** `data` is null when signed out; `isPending` is true until the saved session has been read. */
  useSession() {
    const [session, setSession] = useState<Session | null | undefined>(undefined);
    useEffect(() => {
      if (!authConfigured) {
        setSession(null);
        return;
      }
      let active = true;
      void supabase.auth.getSession().then(({ data }) => active && setSession(data.session));
      const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    }, []);
    const user = session?.user;
    return {
      isPending: session === undefined,
      data: user ? { user: { id: user.id, email: user.email ?? "" } } : null,
    };
  },

  signIn: {
    async email({ email, password }: { email: string; password: string }): Promise<AuthResult> {
      if (!authConfigured) return notConfigured();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? { message: friendly(error.message, error.status), status: error.status } : null };
    },
  },

  signUp: {
    async email(input: {
      email: string;
      password: string;
      name: string;
      role?: string;
      companyName?: string;
    }): Promise<AuthResult> {
      if (!authConfigured) return notConfigured();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        // The database only accepts clerk / agency / landlord from here; admin is never granted by sign-up.
        options: { data: { name: input.name, role: input.role, company_name: input.companyName } },
      });
      if (error) return { error: { message: friendly(error.message, error.status), status: error.status } };
      return { error: null, needsEmailConfirmation: !data.session };
    },
  },

  async signOut() {
    await supabase.auth.signOut();
  },
};
