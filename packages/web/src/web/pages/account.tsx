import { useEffect, useState } from "react";
import { Check, LogOut, Save } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, Field, Input, SectionTitle, Select } from "../components/ui/field";
import { ErrorNote, Loading } from "../components/empty-state";
import { useMe, useUpdateProfile } from "../queries/account";
import { authClient } from "../lib/auth";
import { initials } from "../lib/format";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "../../api/lib/domain";

export default function Account() {
  const me = useMe();
  const update = useUpdateProfile();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("clerk");
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profile = me.data;

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setCompanyName(profile.companyName ?? "");
    setPhone(profile.phone ?? "");
    setRole((profile.role as UserRole) ?? "clerk");
    // Seed the form once per user; later keystrokes must not be overwritten.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (me.isLoading) {
    return (
      <AppShell title="Account">
        <Loading />
      </AppShell>
    );
  }
  if (!profile) {
    return (
      <AppShell title="Account">
        <ErrorNote error={me.error ?? new Error("You are not signed in.")} />
      </AppShell>
    );
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      window.location.href = "/sign-in";
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <AppShell title="Account" subtitle="Your profile and how it appears on reports">
      <div className="flex flex-col gap-4">
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-800 text-[15px] font-semibold text-white">
            {initials(profile.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-ink-900">{profile.name || "Unnamed user"}</p>
            <p className="truncate text-[13px] text-ink-500">{profile.email}</p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-4">
          <div>
            <SectionTitle>Profile</SectionTitle>
            <p className="mt-0.5 text-[13px] text-ink-500">
              Your name and company are printed on every report you generate.
            </p>
          </div>

          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaved(false);
              await update.mutateAsync({
                name: name.trim() || undefined,
                companyName: companyName.trim() ? companyName.trim() : null,
                phone: phone.trim() ? phone.trim() : null,
                // Admin is granted by the operator, never chosen here; an admin's role is left as it is.
                role: role === "admin" ? undefined : role,
              });
              setSaved(true);
            }}
          >
            <Field label="Full name">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
            </Field>

            <Field label="Company / agency" hint="Appears in the report header.">
              <Input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="e.g. Northside Inventories Ltd"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone">
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="e.g. 07700 900123"
                />
              </Field>
              <Field label="I work as">
                <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                  {USER_ROLES.filter((value) => value !== "admin" || profile.role === "admin").map((value) => (
                    <option key={value} value={value}>
                      {USER_ROLE_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <ErrorNote error={update.error} />

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={update.isPending}>
                <Save className="size-4" />
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
              {saved && !update.isPending && (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ok">
                  <Check className="size-4" />
                  Saved
                </span>
              )}
            </div>
          </form>
        </Card>

        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-ink-900">Sign out</p>
            <p className="text-[12px] text-ink-500">
              Photos waiting to sync stay on this device until you sign back in.
            </p>
          </div>
          <Button variant="outline" onClick={() => void signOut()} disabled={signingOut}>
            <LogOut className="size-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
