import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppShell } from "../components/app-shell";
import { Card, Field, Input, Select, Textarea } from "../components/ui/field";
import { Button } from "../components/ui/button";
import { ErrorNote, Loading, Spinner } from "../components/empty-state";
import { useCreateProperty, useProperty, useUpdateProperty } from "../queries/properties";
import { FURNISHING_TYPES, PROPERTY_TYPES } from "../../api/lib/domain";

type FormState = {
  reference: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  propertyType: string;
  furnishing: string;
  bedrooms: string;
  bathrooms: string;
  otherRooms: string;
  landlordName: string;
  landlordEmail: string;
  tenantName: string;
  tenantEmail: string;
  notes: string;
};

const EMPTY: FormState = {
  reference: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  propertyType: PROPERTY_TYPES[0],
  furnishing: FURNISHING_TYPES[0],
  bedrooms: "1",
  bathrooms: "1",
  otherRooms: "0",
  landlordName: "",
  landlordEmail: "",
  tenantName: "",
  tenantEmail: "",
  notes: "",
};

export default function PropertyForm({ id }: { id?: string }) {
  const [, navigate] = useLocation();
  const editing = Boolean(id);
  const existing = useProperty(id);
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = existing.data?.property;
    if (!p) return;
    setForm({
      reference: p.reference ?? "",
      addressLine1: p.addressLine1,
      addressLine2: p.addressLine2 ?? "",
      city: p.city ?? "",
      postcode: p.postcode,
      propertyType: p.propertyType ?? PROPERTY_TYPES[0],
      furnishing: p.furnishing ?? FURNISHING_TYPES[0],
      bedrooms: String(p.bedrooms ?? 0),
      bathrooms: String(p.bathrooms ?? 0),
      otherRooms: String(p.otherRooms ?? 0),
      landlordName: p.landlordName ?? "",
      landlordEmail: p.landlordEmail ?? "",
      tenantName: p.tenantName ?? "",
      tenantEmail: p.tenantEmail ?? "",
      notes: p.notes ?? "",
    });
  }, [existing.data?.property]);

  const set = <K extends keyof FormState>(key: K) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pending = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      reference: form.reference.trim() || null,
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim() || null,
      city: form.city.trim() || null,
      postcode: form.postcode.trim().toUpperCase(),
      propertyType: form.propertyType,
      furnishing: form.furnishing,
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      otherRooms: Number(form.otherRooms) || 0,
      landlordName: form.landlordName.trim() || null,
      landlordEmail: form.landlordEmail.trim() || null,
      tenantName: form.tenantName.trim() || null,
      tenantEmail: form.tenantEmail.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing && id) {
        await update.mutateAsync({ id, ...payload });
        navigate(`/properties/${id}`);
      } else {
        const row = await create.mutateAsync(payload);
        navigate(`/properties/${row.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The property could not be saved.");
    }
  }

  if (editing && existing.isLoading) {
    return (
      <AppShell title="Edit property" back={`/properties/${id}`}>
        <Loading />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={editing ? "Edit property" : "New property"}
      back={editing ? `/properties/${id}` : "/properties"}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Card className="grid gap-3.5 p-4">
          <h2 className="text-[15px] font-semibold text-ink-900">Address</h2>
          <Field label="Address line 1">
            <Input
              value={form.addressLine1}
              onChange={(e) => set("addressLine1")(e.target.value)}
              placeholder="14 Chapel Street"
              required
            />
          </Field>
          <Field label="Address line 2">
            <Input
              value={form.addressLine2}
              onChange={(e) => set("addressLine2")(e.target.value)}
              placeholder="Flat 3"
            />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Town / City">
              <Input value={form.city} onChange={(e) => set("city")(e.target.value)} placeholder="Manchester" />
            </Field>
            <Field label="Postcode">
              <Input
                value={form.postcode}
                onChange={(e) => set("postcode")(e.target.value)}
                placeholder="M1 2AB"
                className="uppercase"
                required
              />
            </Field>
          </div>
          <Field label="Your reference" hint="Optional — your own job or agency reference.">
            <Input value={form.reference} onChange={(e) => set("reference")(e.target.value)} placeholder="JOB-1042" />
          </Field>
        </Card>

        <Card className="grid gap-3.5 p-4">
          <h2 className="text-[15px] font-semibold text-ink-900">Property</h2>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Type">
              <Select value={form.propertyType} onChange={(e) => set("propertyType")(e.target.value)}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Furnishing">
              <Select value={form.furnishing} onChange={(e) => set("furnishing")(e.target.value)}>
                {FURNISHING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bedrooms">
              <Input
                type="number"
                min={0}
                max={30}
                value={form.bedrooms}
                onChange={(e) => set("bedrooms")(e.target.value)}
                className="tabular"
              />
            </Field>
            <Field label="Bathrooms">
              <Input
                type="number"
                min={0}
                max={30}
                value={form.bathrooms}
                onChange={(e) => set("bathrooms")(e.target.value)}
                className="tabular"
              />
            </Field>
            <Field label="Other rooms">
              <Input
                type="number"
                min={0}
                max={60}
                value={form.otherRooms}
                onChange={(e) => set("otherRooms")(e.target.value)}
                className="tabular"
              />
            </Field>
          </div>
          <p className="text-[12px] text-ink-500">
            Room counts pre-build the inspection template — you can still add or remove rooms during the
            inspection.
          </p>
        </Card>

        <Card className="grid gap-3.5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink-900">People</h2>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
              All optional
            </span>
          </div>
          <p className="text-[12px] text-ink-500">
            Landlord and tenant details are not needed to create a property — you can add them later, or leave
            them blank entirely.
          </p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Landlord (optional)">
              <Input
                value={form.landlordName}
                onChange={(e) => set("landlordName")(e.target.value)}
                placeholder="Leave blank if not known"
              />
            </Field>
            <Field label="Landlord email (optional)">
              <Input
                type="email"
                value={form.landlordEmail}
                onChange={(e) => set("landlordEmail")(e.target.value)}
              />
            </Field>
            <Field label="Tenant (optional)">
              <Input value={form.tenantName} onChange={(e) => set("tenantName")(e.target.value)} />
            </Field>
            <Field label="Tenant email (optional)">
              <Input type="email" value={form.tenantEmail} onChange={(e) => set("tenantEmail")(e.target.value)} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              placeholder="Access details, alarm codes, parking, anything the clerk should know."
            />
          </Field>
        </Card>

        <ErrorNote error={error} />

        <div className="flex gap-2.5 pb-4">
          <Button type="submit" className="h-11 flex-1 rounded-[10px] text-[15px]" disabled={pending}>
            {pending && <Spinner />}
            {editing ? "Save changes" : "Create property"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-[10px] border-ink-200 px-5"
            onClick={() => navigate(editing && id ? `/properties/${id}` : "/properties")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
