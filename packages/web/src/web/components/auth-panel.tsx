import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";
import { ErrorNote, Spinner } from "./empty-state";
import { authClient, type ManagedProvider } from "../lib/auth";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "../../api/lib/domain";

export type AuthMode = "signin" | "signup";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4.5">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.2h6.6c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7c2.1-1.9 3.9-4.8 3.9-8.6z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.6-2.9l-3.6-2.8c-1 .7-2.3 1.2-4 1.2a6.9 6.9 0 0 1-6.6-4.8l-.2.1-3.5 2.7C3.4 21.2 7.4 24 12 24z"
      />
      <path fill="#FBBC05" d="M5.4 14.7a7 7 0 0 1 0-5.4l-3.7-2.8a12 12 0 0 0 0 11l3.7-2.8z" />
      <path
        fill="#EA4335"
        d="M12 4.8c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.7 6.5l3.7 2.8A7 7 0 0 1 12 4.8z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4.5 fill-current">
      <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.7-1.8-3.3-1.8-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 3 2.3 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3 .7 1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.5zM14.3 5.3c.6-.8 1.1-1.9 1-3-1 0-2.2.6-2.9 1.5-.6.7-1.1 1.9-1 2.9 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  );
}

/** Email + password, Google and Apple sign-in. Used by the landing page. */
export function AuthPanel({ mode, onModeChange }: { mode: AuthMode; onModeChange: (m: AuthMode) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("clerk");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | ManagedProvider | null>(null);

  useEffect(() => setError(null), [mode]);

  async function managed(provider: ManagedProvider) {
    setError(null);
    setBusy(provider);
    try {
      const result = await authClient.managedAuth.signIn({ provider });
      if (result.error && result.error.code !== "POPUP_CLOSED") {
        setError(result.error.message ?? "Sign-in did not complete.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in did not complete.");
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("email");
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim(),
              // @ts-expect-error additional fields are configured on the server
              role,
              companyName: companyName.trim() || undefined,
            })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) setError(result.error.message ?? "Those details were not accepted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Those details were not accepted.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full">
      <h2 className="text-[22px] font-bold text-ink-900">
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h2>
      <p className="mt-1 text-[14px] text-ink-500">
        {mode === "signin"
          ? "Pick up where your last inspection left off."
          : "Set up in under a minute — no card needed."}
      </p>

      <div className="mt-6 grid gap-2.5">
        <Button
          type="button"
          variant="outline"
          className="h-11 justify-center gap-2.5 rounded-[10px] border-ink-200 text-[14px] font-medium"
          disabled={busy !== null}
          onClick={() => void managed("google")}
        >
          {busy === "google" ? <Spinner /> : <GoogleMark />}
          Continue with Google
        </Button>
        <Button
          type="button"
          className="h-11 justify-center gap-2.5 rounded-[10px] bg-ink-900 text-[14px] font-medium text-white hover:bg-ink-900/90"
          disabled={busy !== null}
          onClick={() => void managed("apple")}
        >
          {busy === "apple" ? <Spinner /> : <AppleMark />}
          Continue with Apple
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.1em] text-ink-300">
        <span className="h-px flex-1 bg-ink-200" />
        or
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <form className="grid gap-3.5" onSubmit={submit}>
        {mode === "signup" && (
          <>
            <Field label="Your name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Alex Morgan"
                required
              />
            </Field>
            <Field label="You are a">
              <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {USER_ROLES.filter((r) => r !== "admin").map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Company (optional)">
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
                placeholder="Morgan Inventories Ltd"
              />
            </Field>
          </>
        )}
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@company.co.uk"
            required
          />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" className="mt-1 h-11 rounded-[10px] text-[15px]" disabled={busy !== null}>
          {busy === "email" && <Spinner />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-ink-500">
        {mode === "signin" ? "New to In360View?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-brand-800 underline-offset-2 hover:underline"
          onClick={() => onModeChange(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
