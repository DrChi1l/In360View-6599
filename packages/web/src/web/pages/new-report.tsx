import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Check, LogIn, LogOut, Minus, Plus, RotateCw } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, Field, Input, SectionTitle } from "../components/ui/field";
import { ErrorNote, Loading, Spinner } from "../components/empty-state";
import { useProperty } from "../queries/properties";
import { useBaseCandidates, useCreateReport } from "../queries/reports";
import { formatDate, formatDateInput, shortAddress } from "../lib/format";
import {
  REPORT_TYPE_LABELS,
  ROOM_TEMPLATES,
  suggestedRooms,
  type ReportType,
} from "../../api/lib/domain";

const TYPE_META: Record<ReportType, { icon: typeof LogIn; blurb: string }> = {
  check_in: { icon: LogIn, blurb: "A full inventory at the start of the tenancy." },
  check_out: { icon: LogOut, blurb: "Compare the property against an earlier check-in." },
  mid_term: { icon: RotateCw, blurb: "A periodic visit part-way through the tenancy." },
};

type Draft = { type: string; name: string };

export default function NewReport({ propertyId }: { propertyId?: string }) {
  const [, navigate] = useLocation();
  const property = useProperty(propertyId);
  const candidates = useBaseCandidates(propertyId);
  const create = useCreateReport();

  const [type, setType] = useState<ReportType>("check_in");
  const [baseReportId, setBaseReportId] = useState<string | null>(null);
  const [date, setDate] = useState(formatDateInput(new Date()));
  const [tenantPresent, setTenantPresent] = useState(false);
  const [rooms, setRooms] = useState<Draft[]>([]);

  const suggested = useMemo(() => {
    const p = property.data?.property;
    if (!p) return [];
    return suggestedRooms({ bedrooms: p.bedrooms, bathrooms: p.bathrooms, otherRooms: p.otherRooms });
  }, [property.data?.property]);

  useEffect(() => {
    if (suggested.length) setRooms(suggested);
  }, [suggested]);

  useEffect(() => {
    if (type !== "check_out") setBaseReportId(null);
    else if (!baseReportId && candidates.data?.length) setBaseReportId(candidates.data[0]!.id);
  }, [type, candidates.data, baseReportId]);

  if (property.isLoading) {
    return (
      <AppShell title="New inspection" back={`/properties/${propertyId}`}>
        <Loading />
      </AppShell>
    );
  }
  if (!property.data) {
    return (
      <AppShell title="New inspection" back="/properties">
        <ErrorNote error={property.error ?? new Error("Property not found.")} />
      </AppShell>
    );
  }

  const copyingStructure = type === "check_out" && Boolean(baseReportId);

  function addRoom(templateType: string) {
    const template = ROOM_TEMPLATES.find((t) => t.type === templateType);
    if (!template) return;
    const sameType = rooms.filter((r) => r.type === templateType).length;
    setRooms((list) => [
      ...list,
      { type: templateType, name: sameType ? `${template.name} ${sameType + 1}` : template.name },
    ]);
  }

  return (
    <AppShell
      title="New inspection"
      subtitle={shortAddress(property.data.property)}
      back={`/properties/${propertyId}`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!propertyId) return;
          create.mutate(
            {
              propertyId,
              type,
              baseReportId: type === "check_out" ? baseReportId : null,
              inspectionDate: date ? new Date(`${date}T09:00:00`).getTime() : undefined,
              tenantPresent,
              rooms: copyingStructure ? undefined : rooms.filter((r) => r.name.trim()),
            },
            { onSuccess: (row) => row && navigate(`/reports/${row.id}`) },
          );
        }}
      >
        <Card className="p-4">
          <SectionTitle className="mb-3 text-[15px]">Inspection type</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(TYPE_META) as ReportType[]).map((key) => {
              const meta = TYPE_META[key];
              const active = type === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={
                    "flex flex-col gap-1.5 rounded-[12px] border p-3 text-left transition-colors " +
                    (active
                      ? "border-brand-800 bg-brand-50 ring-1 ring-brand-800"
                      : "border-ink-200 hover:border-brand-500")
                  }
                >
                  <span className="flex items-center gap-2">
                    <meta.icon className={active ? "size-4.5 text-brand-800" : "size-4.5 text-ink-500"} />
                    <span className="text-[14px] font-semibold text-ink-900">{REPORT_TYPE_LABELS[key]}</span>
                    {active && <Check className="ml-auto size-4 text-brand-800" />}
                  </span>
                  <span className="text-[12px] leading-snug text-ink-500">{meta.blurb}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {type === "check_out" && (
          <Card className="p-4">
            <SectionTitle className="mb-1 text-[15px]">Compare against</SectionTitle>
            <p className="mb-3 text-[12px] text-ink-500">
              The check-out copies the rooms and items of this report, so every line can be compared.
            </p>
            {candidates.isLoading ? (
              <Loading label="Finding earlier reports…" className="py-6" />
            ) : !candidates.data?.length ? (
              <p className="rounded-[10px] bg-warn-soft px-3 py-2 text-[13px] text-warn">
                There is no check-in on this property yet. The check-out will be built from the room templates
                instead.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {candidates.data.map((row) => {
                  const active = baseReportId === row.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setBaseReportId(active ? null : row.id)}
                      className={
                        "flex items-center gap-3 rounded-[10px] border p-3 text-left transition-colors " +
                        (active ? "border-brand-800 bg-brand-50" : "border-ink-200 hover:border-brand-500")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-900">
                          {REPORT_TYPE_LABELS[row.type as ReportType] ?? row.type} ·{" "}
                          {row.reference ?? row.id}
                        </p>
                        <p className="text-[12px] text-ink-500">{formatDate(row.inspectionDate)}</p>
                      </div>
                      {active && <Check className="size-4 shrink-0 text-brand-800" />}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        <Card className="p-4">
          <SectionTitle className="mb-3 text-[15px]">Visit</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Inspection date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Tenant">
              <label className="flex h-11 items-center gap-2.5 rounded-[10px] border border-ink-200 px-3">
                <input
                  type="checkbox"
                  aria-label="Tenant present at the inspection"
                  checked={tenantPresent}
                  onChange={(e) => setTenantPresent(e.target.checked)}
                  className="size-4 accent-brand-800"
                />
                <span className="text-[14px] text-ink-700">Tenant present at the inspection</span>
              </label>
            </Field>
          </div>
        </Card>

        {!copyingStructure && (
          <Card className="p-4">
            <SectionTitle className="mb-1 text-[15px]">Rooms</SectionTitle>
            <p className="mb-3 text-[12px] text-ink-500">
              Proposed from the property details. Each room is created with its standard item list — you can
              add or remove rooms later too.
            </p>
            <div className="flex flex-col gap-2">
              {rooms.map((room, index) => (
                <div key={`${room.type}-${index}`} className="flex items-center gap-2">
                  <Input
                    value={room.name}
                    onChange={(e) =>
                      setRooms((list) =>
                        list.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)),
                      )
                    }
                    className="h-10"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${room.name}`}
                    onClick={() => setRooms((list) => list.filter((_, i) => i !== index))}
                    className="grid size-10 shrink-0 place-items-center rounded-[10px] text-ink-500 hover:bg-danger-soft hover:text-danger"
                  >
                    <Minus className="size-4" />
                  </button>
                </div>
              ))}
              {rooms.length === 0 && <p className="text-[13px] text-ink-500">No rooms yet — add one below.</p>}
            </div>

            <div className="mt-3 border-t border-ink-100 pt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
                Add a room
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_TEMPLATES.map((template) => (
                  <button
                    key={template.type}
                    type="button"
                    onClick={() => addRoom(template.type)}
                    className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-brand-500 hover:text-brand-800"
                  >
                    <Plus className="size-3.5" />
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        )}

        <ErrorNote error={create.error} />

        <div className="flex justify-end gap-2 pb-2">
          <Button type="submit" size="lg" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <ArrowRight className="size-4" />}
            Start inspection
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
