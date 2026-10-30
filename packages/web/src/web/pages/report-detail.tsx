import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileDown,
  FileText,
  Gauge,
  KeyRound,
  Lock,
  Mail,
  PenLine,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, Field, Input, Select, SectionTitle, Textarea } from "../components/ui/field";
import { EmptyState, ErrorNote, Loading, Spinner } from "../components/empty-state";
import { CleanlinessPill, ConditionPill, StatusPill, TypePill } from "../components/status-pill";
import { CleanlinessPicker, ConditionPicker } from "../components/chip-picker";
import { PhotoGrid } from "../components/photo-grid";
import { SwipeRow } from "../components/swipe-row";
import {
  useCompleteReport,
  useDeleteReport,
  useReopenReport,
  useReport,
  useSaveKeys,
  useSaveMeters,
  useUpdateReport,
} from "../queries/reports";
import { useAddRoom, useRemoveRoom } from "../queries/inspection";
import { useEmailReport, useGeneratePdf, useReportPdf } from "../queries/documents";
import { formatDate, formatDateInput, pluralise, shortAddress } from "../lib/format";
import { METER_TYPES, ROOM_TEMPLATES } from "../../api/lib/domain";
import { TenantShare } from "../components/tenant-share";

export default function ReportDetail({ id }: { id?: string }) {
  const [, navigate] = useLocation();
  const query = useReport(id);
  const complete = useCompleteReport();
  const reopen = useReopenReport();
  const remove = useDeleteReport();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (query.isLoading) {
    return (
      <AppShell title="Inspection" back="/reports">
        <Loading />
      </AppShell>
    );
  }
  if (query.error || !query.data) {
    return (
      <AppShell title="Inspection" back="/reports">
        <ErrorNote error={query.error ?? new Error("Report not found.")} />
      </AppShell>
    );
  }

  const { report, property, rooms, meters, keys, signatures } = query.data;
  const locked = Boolean(report.lockedAt);
  const doneRooms = rooms.filter((r) => r.completed).length;
  const photoTotal = query.data.photos.length;

  return (
    <AppShell
      title={shortAddress(property)}
      subtitle={`${report.reference ?? report.id} · ${formatDate(report.inspectionDate)}`}
      back={`/properties/${property.id}`}
      wide
      actions={
        <Link href={`/reports/${report.id}/sign`}>
          <Button size="sm" variant={locked ? "outline" : "default"} className={locked ? "border-ink-200" : ""}>
            {locked ? <Lock className="size-4" /> : <PenLine className="size-4" />}
            <span className="hidden sm:inline">{locked ? "Signed" : "Sign off"}</span>
          </Button>
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypePill type={report.type} />
              <StatusPill status={report.status} locked={locked} />
              {signatures.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-medium text-brand-800">
                  <PenLine className="size-3" />
                  {pluralise(signatures.length, "signature")}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-700">
                <Camera className="size-3" />
                {photoTotal}
              </span>
            </div>
            {locked && (
              <p className="mt-3 flex items-start gap-2 rounded-[10px] bg-ok-soft px-3 py-2 text-[13px] text-ok">
                <Lock className="mt-0.5 size-4 shrink-0" />
                Signed on {formatDate(report.lockedAt)}. This report is locked and can no longer be changed.
              </p>
            )}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[12px] text-ink-500">
                <span>Room progress</span>
                <span className="tabular">
                  {doneRooms}/{rooms.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-800 transition-all"
                  style={{ width: `${rooms.length ? (doneRooms / rooms.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </Card>

          <Rooms reportId={report.id} rooms={rooms} locked={locked} />

          <section>
            <SectionTitle className="mb-2">General photos</SectionTitle>
            <Card className="p-3">
              <PhotoGrid
                scope={{ reportId: report.id, roomId: null, itemId: null }}
                locked={locked}
                emptyLabel="No property-wide photos. Use these for the frontage, meters or documents."
              />
            </Card>
          </section>

          <Summary report={report} locked={locked} />
          <Meters reportId={report.id} rows={meters} locked={locked} />
          <Keys reportId={report.id} rows={keys} locked={locked} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <TenantShare reportId={report.id} completed={report.status !== "draft"} />
          <Card className="p-4">
            <SectionTitle className="mb-3 text-[15px]">Report</SectionTitle>
            <div className="flex flex-col gap-2">
              {!locked && report.status === "draft" && (
                <Button
                  disabled={complete.isPending}
                  onClick={() => complete.mutate({ id: report.id })}
                  className="justify-start"
                >
                  {complete.isPending ? <Spinner /> : <CheckCircle2 className="size-4" />}
                  Mark inspection complete
                </Button>
              )}
              {!locked && report.status === "completed" && (
                <Button
                  variant="outline"
                  className="justify-start border-ink-200"
                  disabled={reopen.isPending}
                  onClick={() => reopen.mutate({ id: report.id })}
                >
                  {reopen.isPending ? <Spinner /> : <RotateCcw className="size-4" />}
                  Reopen as draft
                </Button>
              )}
              <Link href={`/reports/${report.id}/sign`}>
                <Button variant="outline" className="w-full justify-start border-ink-200">
                  <PenLine className="size-4" />
                  Signatures ({signatures.length})
                </Button>
              </Link>
              <ErrorNote error={complete.error ?? reopen.error} />
            </div>
          </Card>

          <Pdf reportId={report.id} />

          {!locked && (
            <Card className="p-4">
              {confirmDelete ? (
                <div className="rounded-[10px] bg-danger-soft p-3">
                  <p className="text-[13px] text-danger">
                    Delete this inspection and all of its photos? This cannot be undone.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(
                          { id: report.id },
                          { onSuccess: () => navigate(`/properties/${property.id}`) },
                        )
                      }
                    >
                      {remove.isPending ? <Spinner /> : <Trash2 className="size-4" />}
                      Delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-danger hover:bg-danger-soft"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete inspection
                </Button>
              )}
              <ErrorNote error={remove.error} className="mt-2" />
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ----------------------------------------------------------------- rooms */

type RoomRow = {
  id: string;
  name: string;
  roomType: string;
  completed: boolean;
  condition: string | null;
  cleanliness: string | null;
  photoCount: number;
  items: { id: string; condition: string | null }[];
};

function Rooms({ reportId, rooms, locked }: { reportId: string; rooms: RoomRow[]; locked: boolean }) {
  const addRoom = useAddRoom(reportId);
  const removeRoom = useRemoveRoom(reportId);
  const [adding, setAdding] = useState(false);
  const [template, setTemplate] = useState("bedroom");
  const [name, setName] = useState("");

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Rooms</SectionTitle>
        {!locked && (
          <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-4" />
            Add room
          </Button>
        )}
      </div>

      {adding && !locked && (
        <Card className="mb-2 p-3">
          <form
            className="flex flex-col gap-2.5 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const chosen = ROOM_TEMPLATES.find((t) => t.type === template);
              addRoom.mutate(
                {
                  reportId,
                  roomType: template,
                  name: name.trim() || chosen?.name || "Room",
                  withTemplateItems: true,
                },
                {
                  onSuccess: () => {
                    setAdding(false);
                    setName("");
                  },
                },
              );
            }}
          >
            <Field label="Template" className="sm:w-48">
              <Select value={template} onChange={(e) => setTemplate(e.target.value)}>
                {ROOM_TEMPLATES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Room name" className="flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={ROOM_TEMPLATES.find((t) => t.type === template)?.name ?? "Room"}
              />
            </Field>
            <Button type="submit" disabled={addRoom.isPending} className="h-11">
              {addRoom.isPending ? <Spinner /> : <Plus className="size-4" />}
              Add
            </Button>
          </form>
          <ErrorNote error={addRoom.error} className="mt-2" />
        </Card>
      )}

      {rooms.length === 0 ? (
        <Card>
          <EmptyState title="This inspection has no rooms yet." />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rooms.map((room) => {
            const scored = room.items.filter((i) => i.condition).length;
            return (
              <SwipeRow
                key={room.id}
                className="rounded-[14px] border border-ink-100 bg-white shadow-soft transition-colors hover:border-brand-500"
                label={`Remove ${room.name}`}
                disabled={locked}
                pending={removeRoom.isPending}
                onDelete={() => removeRoom.mutate({ id: room.id })}
              >
                <Link
                  href={`/reports/${reportId}/rooms/${room.id}`}
                  className="flex min-w-0 items-center gap-3 p-3.5"
                >
                  <span
                    className={
                      "grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold " +
                      (room.completed ? "bg-ok-soft text-ok" : "bg-ink-100 text-ink-500")
                    }
                  >
                    {room.completed ? <Check className="size-4" /> : `${scored}/${room.items.length}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink-900">{room.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ConditionPill value={room.condition} />
                      <CleanlinessPill value={room.cleanliness} />
                      {room.photoCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                          <Camera className="size-3" />
                          {room.photoCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-ink-300" />
                </Link>
              </SwipeRow>
            );
          })}
        </div>
      )}
      {!locked && rooms.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-500">Swipe a room left to delete it.</p>
      )}
      <ErrorNote error={removeRoom.error} className="mt-2" />
    </section>
  );
}

/* --------------------------------------------------------------- summary */

type ReportRow = {
  id: string;
  inspectionDate: Date;
  tenantPresent: boolean;
  weather: string | null;
  generalCondition: string | null;
  generalCleanliness: string | null;
  maintenanceIssues: string | null;
  tenantObservations: string | null;
  summaryNotes: string | null;
};

function Summary({ report, locked }: { report: ReportRow; locked: boolean }) {
  const update = useUpdateReport();
  const [form, setForm] = useState({
    inspectionDate: formatDateInput(report.inspectionDate),
    tenantPresent: report.tenantPresent,
    weather: report.weather ?? "",
    generalCondition: report.generalCondition,
    generalCleanliness: report.generalCleanliness,
    maintenanceIssues: report.maintenanceIssues ?? "",
    tenantObservations: report.tenantObservations ?? "",
    summaryNotes: report.summaryNotes ?? "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      inspectionDate: formatDateInput(report.inspectionDate),
      tenantPresent: report.tenantPresent,
      weather: report.weather ?? "",
      generalCondition: report.generalCondition,
      generalCleanliness: report.generalCleanliness,
      maintenanceIssues: report.maintenanceIssues ?? "",
      tenantObservations: report.tenantObservations ?? "",
      summaryNotes: report.summaryNotes ?? "",
    });
  }, [report]);

  return (
    <section>
      <SectionTitle className="mb-2">Overall &amp; summary</SectionTitle>
      <Card className="p-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSaved(false);
            update.mutate(
              {
                id: report.id,
                inspectionDate: form.inspectionDate
                  ? new Date(`${form.inspectionDate}T09:00:00`).getTime()
                  : undefined,
                tenantPresent: form.tenantPresent,
                weather: form.weather.trim() || null,
                generalCondition: form.generalCondition,
                generalCleanliness: form.generalCleanliness,
                maintenanceIssues: form.maintenanceIssues.trim() || null,
                tenantObservations: form.tenantObservations.trim() || null,
                summaryNotes: form.summaryNotes.trim() || null,
              },
              { onSuccess: () => setSaved(true) },
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Inspection date">
              <Input
                type="date"
                disabled={locked}
                value={form.inspectionDate}
                onChange={(e) => setForm((f) => ({ ...f, inspectionDate: e.target.value }))}
              />
            </Field>
            <Field label="Weather / conditions">
              <Input
                disabled={locked}
                value={form.weather}
                placeholder="Dry, mild"
                onChange={(e) => setForm((f) => ({ ...f, weather: e.target.value }))}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-[14px] text-ink-700">
            <input
              type="checkbox"
              aria-label="Tenant present at the inspection"
              disabled={locked}
              checked={form.tenantPresent}
              onChange={(e) => setForm((f) => ({ ...f, tenantPresent: e.target.checked }))}
              className="size-4 accent-brand-800"
            />
            Tenant present at the inspection
          </label>

          <ConditionPicker
            label="Overall condition"
            disabled={locked}
            value={form.generalCondition}
            onChange={(v) => setForm((f) => ({ ...f, generalCondition: v }))}
          />
          <CleanlinessPicker
            label="Overall cleanliness"
            disabled={locked}
            value={form.generalCleanliness}
            onChange={(v) => setForm((f) => ({ ...f, generalCleanliness: v }))}
          />

          <Field label="Maintenance issues">
            <Textarea
              disabled={locked}
              value={form.maintenanceIssues}
              placeholder="Anything needing attention from the landlord."
              onChange={(e) => setForm((f) => ({ ...f, maintenanceIssues: e.target.value }))}
            />
          </Field>
          <Field label="Tenant observations">
            <Textarea
              disabled={locked}
              value={form.tenantObservations}
              placeholder="Comments the tenant made during the visit."
              onChange={(e) => setForm((f) => ({ ...f, tenantObservations: e.target.value }))}
            />
          </Field>
          <Field label="Summary notes">
            <Textarea
              disabled={locked}
              value={form.summaryNotes}
              placeholder="Closing remarks for the report."
              onChange={(e) => setForm((f) => ({ ...f, summaryNotes: e.target.value }))}
            />
          </Field>

          <ErrorNote error={update.error} />
          {!locked && (
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? <Spinner /> : <Check className="size-4" />}
                Save summary
              </Button>
              {saved && !update.isPending && <span className="text-[13px] text-ok">Saved</span>}
            </div>
          )}
        </form>
      </Card>
    </section>
  );
}

/* ---------------------------------------------------------------- meters */

type MeterRow = {
  meterType: string;
  serialNumber: string | null;
  reading: string | null;
  location: string | null;
  notes: string | null;
};

function Meters({ reportId, rows, locked }: { reportId: string; rows: MeterRow[]; locked: boolean }) {
  const save = useSaveMeters(reportId);
  const [list, setList] = useState<MeterRow[]>(rows);
  const [saved, setSaved] = useState(false);

  useEffect(() => setList(rows), [rows]);

  return (
    <section>
      <SectionTitle className="mb-2">Meter readings</SectionTitle>
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          {list.length === 0 && <p className="text-[13px] text-ink-500">No readings recorded.</p>}
          {list.map((row, index) => (
            <div key={index} className="grid gap-2 rounded-[10px] bg-ink-100/50 p-3 sm:grid-cols-4">
              <Field label="Meter">
                <Select
                  disabled={locked}
                  value={row.meterType}
                  onChange={(e) =>
                    setList((l) => l.map((r, i) => (i === index ? { ...r, meterType: e.target.value } : r)))
                  }
                >
                  {METER_TYPES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reading">
                <Input
                  disabled={locked}
                  value={row.reading ?? ""}
                  onChange={(e) =>
                    setList((l) => l.map((r, i) => (i === index ? { ...r, reading: e.target.value } : r)))
                  }
                />
              </Field>
              <Field label="Serial number">
                <Input
                  disabled={locked}
                  value={row.serialNumber ?? ""}
                  onChange={(e) =>
                    setList((l) => l.map((r, i) => (i === index ? { ...r, serialNumber: e.target.value } : r)))
                  }
                />
              </Field>
              <Field label="Location">
                <div className="flex gap-2">
                  <Input
                    disabled={locked}
                    value={row.location ?? ""}
                    onChange={(e) =>
                      setList((l) => l.map((r, i) => (i === index ? { ...r, location: e.target.value } : r)))
                    }
                  />
                  {!locked && (
                    <button
                      type="button"
                      aria-label="Remove reading"
                      className="grid size-11 shrink-0 place-items-center rounded-[10px] text-ink-500 hover:bg-danger-soft hover:text-danger"
                      onClick={() => setList((l) => l.filter((_, i) => i !== index))}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </Field>
            </div>
          ))}
        </div>

        {!locked && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-ink-200"
              onClick={() =>
                setList((l) => [
                  ...l,
                  { meterType: "electricity", serialNumber: "", reading: "", location: "", notes: "" },
                ])
              }
            >
              <Plus className="size-4" />
              Add reading
            </Button>
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                setSaved(false);
                save.mutate(
                  {
                    reportId,
                    readings: list.map((r) => ({
                      meterType: r.meterType,
                      serialNumber: r.serialNumber || null,
                      reading: r.reading || null,
                      location: r.location || null,
                      notes: r.notes || null,
                    })),
                  },
                  { onSuccess: () => setSaved(true) },
                );
              }}
            >
              {save.isPending ? <Spinner /> : <Gauge className="size-4" />}
              Save readings
            </Button>
            {saved && !save.isPending && <span className="text-[13px] text-ok">Saved</span>}
          </div>
        )}
        <ErrorNote error={save.error} className="mt-2" />
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ keys */

type KeyRow = { description: string; quantity: number; notes: string | null };

function Keys({ reportId, rows, locked }: { reportId: string; rows: KeyRow[]; locked: boolean }) {
  const save = useSaveKeys(reportId);
  const [list, setList] = useState<KeyRow[]>(rows);
  const [saved, setSaved] = useState(false);

  useEffect(() => setList(rows), [rows]);

  return (
    <section>
      <SectionTitle className="mb-2">Keys</SectionTitle>
      <Card className="p-4">
        <div className="flex flex-col gap-2">
          {list.length === 0 && <p className="text-[13px] text-ink-500">No keys recorded.</p>}
          {list.map((row, index) => (
            <div key={index} className="flex items-end gap-2">
              <Field label="Description" className="flex-1">
                <Input
                  disabled={locked}
                  value={row.description}
                  placeholder="Front door Yale"
                  onChange={(e) =>
                    setList((l) => l.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)))
                  }
                />
              </Field>
              <Field label="Qty" className="w-20">
                <Input
                  type="number"
                  min={0}
                  disabled={locked}
                  value={row.quantity}
                  onChange={(e) =>
                    setList((l) =>
                      l.map((r, i) => (i === index ? { ...r, quantity: Number(e.target.value) || 0 } : r)),
                    )
                  }
                />
              </Field>
              {!locked && (
                <button
                  type="button"
                  aria-label="Remove key"
                  className="grid size-11 shrink-0 place-items-center rounded-[10px] text-ink-500 hover:bg-danger-soft hover:text-danger"
                  onClick={() => setList((l) => l.filter((_, i) => i !== index))}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {!locked && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-ink-200"
              onClick={() => setList((l) => [...l, { description: "", quantity: 1, notes: null }])}
            >
              <Plus className="size-4" />
              Add key
            </Button>
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                setSaved(false);
                save.mutate(
                  {
                    reportId,
                    keys: list
                      .filter((k) => k.description.trim())
                      .map((k) => ({
                        description: k.description.trim(),
                        quantity: k.quantity,
                        notes: k.notes || null,
                      })),
                  },
                  { onSuccess: () => setSaved(true) },
                );
              }}
            >
              {save.isPending ? <Spinner /> : <KeyRound className="size-4" />}
              Save keys
            </Button>
            {saved && !save.isPending && <span className="text-[13px] text-ok">Saved</span>}
          </div>
        )}
        <ErrorNote error={save.error} className="mt-2" />
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------- pdf */

function Pdf({ reportId }: { reportId: string }) {
  const pdf = useReportPdf(reportId);
  const generate = useGeneratePdf(reportId);
  const email = useEmailReport();
  const [to, setTo] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <Card className="p-4">
      <SectionTitle className="mb-3 text-[15px]">PDF report</SectionTitle>
      <div className="flex flex-col gap-2">
        <Link href={`/reports/${reportId}/view`}>
          <Button variant="outline" className="w-full justify-start border-ink-200">
            <FileText className="size-4" />
            View report online
          </Button>
        </Link>
        <Button
          className="justify-start"
          disabled={generate.isPending}
          onClick={() => generate.mutate({ reportId })}
        >
          {generate.isPending ? <Spinner /> : <FileDown className="size-4" />}
          {pdf.data?.url ? "Regenerate PDF" : "Generate PDF"}
        </Button>

        {pdf.data?.url && (
          <>
            <a href={pdf.data.url} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full justify-start border-ink-200">
                <Download className="size-4" />
                View / download
              </Button>
            </a>
            <p className="text-[12px] text-ink-500">
              Last generated {formatDate(pdf.data.generatedAt)}
            </p>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => setShowEmail((v) => !v)}
            >
              <Mail className="size-4" />
              Email report
            </Button>
          </>
        )}

        {showEmail && (
          <form
            className="flex flex-col gap-2 rounded-[10px] bg-brand-50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(false);
              const recipients = to
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              if (!recipients.length) return;
              email.mutate({ reportId, to: recipients }, { onSuccess: () => setSent(true) });
            }}
          >
            <Field label="Recipients" hint="Separate several addresses with commas.">
              <Input
                type="text"
                value={to}
                placeholder="tenant@example.com, landlord@example.com"
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <ErrorNote error={email.error} />
            {sent && <p className="text-[13px] text-ok">Sent.</p>}
            <Button type="submit" size="sm" disabled={email.isPending}>
              {email.isPending ? <Spinner /> : <Mail className="size-4" />}
              Send
            </Button>
          </form>
        )}

        <ErrorNote error={generate.error} />
      </div>
    </Card>
  );
}
