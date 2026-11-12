import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";
import { ErrorNote, Spinner } from "./empty-state";
import { authClient } from "../lib/auth";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "../../api/lib/domain";

export type AuthMode = "signin" | "signup";

/** Email + password sign-in and account registration. */
export function AuthPanel({ mode, onModeChange }: { mode: AuthMode; onModeChange: (m: AuthMode) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("clerk");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(null), [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <h2 className="text-[22px] font-bold text-ink-900">
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h2>
      <p className="mt-1 text-[14px] text-ink-500">
        {mode === "signin"
          ? "Enter your email and password to access your dashboard."
          : "Register with your email to start managing property inspections."}
      </p>

      <form className="mt-6 grid gap-3.5" onSubmit={submit}>
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
        <Button type="submit" className="mt-2 h-11 rounded-[10px] text-[15px]" disabled={busy}>
          {busy && <Spinner />}
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
