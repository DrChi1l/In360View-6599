import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  ClipboardPlus,
  Expand,
  FileText,
  ImagePlus,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, Field, Input, Select, SectionTitle, Textarea } from "../components/ui/field";
import { EmptyState, ErrorNote, Loading, Spinner } from "../components/empty-state";
import { StatusPill, TypePill } from "../components/status-pill";
import {
  useArchiveProperty,
  useCancelSchedule,
  useDeleteProperty,
  useProperty,
  useRemoveFrontPhoto,
  useScheduleInspection,
  useUploadFrontPhoto,
} from "../queries/properties";
import { formatDate, fullAddress, pluralise } from "../lib/format";
import { REPORT_TYPES, REPORT_TYPE_LABELS, type ReportType } from "../../api/lib/domain";

export default function PropertyDetail({ id }: { id?: string }) {
  const [, navigate] = useLocation();
  const query = useProperty(id);
  const archive = useArchiveProperty();
  const remove = useDeleteProperty();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (query.isLoading) {
    return (
      <AppShell title="Property" back="/properties">
        <Loading />
      </AppShell>
    );
  }
  if (query.error || !query.data) {
    return (
      <AppShell title="Property" back="/properties">
        <ErrorNote error={query.error ?? new Error("Property not found.")} />
      </AppShell>
    );
  }

  const { property, reports, recentPhotos, upcoming } = query.data;

  return (
    <AppShell
      title={property.addressLine1}
      subtitle={[property.city, property.postcode].filter(Boolean).join(" · ")}
      back="/properties"
      wide
      actions={
        <Link href={`/properties/${property.id}/edit`}>
          <Button size="sm" variant="outline" className="border-ink-200">
            <Pencil className="size-4" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="relative overflow-hidden p-4">
            {property.frontPhotoThumbUrl && (
              <CornerPhoto url={property.frontPhotoThumbUrl} fullUrl={property.frontPhotoUrl} />
            )}
            <div
              className={`flex flex-wrap items-start justify-between gap-3 ${
                property.frontPhotoThumbUrl ? "pr-[84px] sm:pr-[150px]" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink-900">{fullAddress(property)}</p>
                <p className="mt-0.5 text-[13px] text-ink-500">
                  {[property.propertyType, property.furnishing].filter(Boolean).join(" · ") || "Type not set"}
                </p>
              </div>
              {property.archived && (
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-700">
                  Archived
                </span>
              )}
            </div>
            <div
              className={`mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink-100 pt-3 text-[13px] text-ink-700 ${
                property.frontPhotoThumbUrl ? "sm:pr-[150px]" : ""
              }`}
            >
              <Detail label="Reference" value={property.reference} />
              <Detail label="Bedrooms" value={String(property.bedrooms)} />
              <Detail label="Bathrooms" value={String(property.bathrooms)} />
              <Detail label="Other rooms" value={String(property.otherRooms)} />
            </div>
            <div
              className={`mt-3 grid gap-x-6 gap-y-2 border-t border-ink-100 pt-3 sm:grid-cols-2 ${
                property.frontPhotoThumbUrl ? "sm:pr-[150px]" : ""
              }`}
            >
              <Detail label="Landlord" value={property.landlordName} sub={property.landlordEmail} />
              <Detail label="Tenant" value={property.tenantName} sub={property.tenantEmail} />
            </div>
            {property.notes && (
              <p className="mt-3 whitespace-pre-wrap border-t border-ink-100 pt-3 text-[13px] leading-relaxed text-ink-700">
                {property.notes}
              </p>
            )}
          </Card>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <SectionTitle>Inspection history</SectionTitle>
              <Link href={`/properties/${property.id}/inspect`}>
                <Button size="sm">
                  <ClipboardPlus className="size-4" />
                  New inspection
                </Button>
              </Link>
            </div>
            {reports.length === 0 ? (
              <Card>
                <EmptyState title="No inspections on this property yet." />
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {reports.map((report) => (
                  <Link key={report.id} href={`/reports/${report.id}`}>
                    <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-brand-500">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800">
                        <FileText className="size-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <TypePill type={report.type} />
                          <StatusPill status={report.status} locked={Boolean(report.lockedAt)} />
                        </div>
                        <p className="mt-1 truncate text-[12px] text-ink-500">
                          {formatDate(report.inspectionDate)} · {report.reference ?? report.id} ·{" "}
                          {pluralise(report.roomCount, "room")} · {pluralise(report.photoCount, "photo")}
                        </p>
                      </div>
                      {report.pdfKey && (
                        <span className="shrink-0 rounded-full bg-ok-soft px-2 py-0.5 text-[10px] font-medium text-ok">
                          PDF
                        </span>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <FrontPhoto
            propertyId={property.id}
            url={property.frontPhotoThumbUrl}
            fullUrl={property.frontPhotoUrl}
            updatedAt={property.frontPhotoUpdatedAt}
          />


          {recentPhotos.length > 0 && (
            <section>
              <SectionTitle className="mb-2">Recent photos</SectionTitle>
              <Card className="p-3">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {recentPhotos.map((photo) => (
                    <Link
                      key={photo.id}
                      href={`/reports/${photo.reportId}`}
                      className="aspect-square overflow-hidden rounded-[8px] bg-ink-100"
                    >
                      <img
                        src={photo.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    </Link>
                  ))}
                </div>
              </Card>
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Schedule propertyId={property.id} upcoming={upcoming} />

          <Card className="p-4">
            <SectionTitle className="mb-3 text-[15px]">Manage</SectionTitle>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start border-ink-200"
                disabled={archive.isPending}
                onClick={() => archive.mutate({ id: property.id, archived: !property.archived })}
              >
                {property.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                {property.archived ? "Restore property" : "Archive property"}
              </Button>
              {confirmDelete ? (
                <div className="rounded-[10px] bg-danger-soft p-3">
                  <p className="text-[13px] text-danger">
                    Delete this property and every inspection, photo and report attached to it? This cannot be
                    undone.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate({ id: property.id }, { onSuccess: () => navigate("/properties") })
                      }
                    >
                      {remove.isPending ? <Spinner /> : <Trash2 className="size-4" />}
                      Delete for good
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="justify-start text-danger hover:bg-danger-soft"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete property
                </Button>
              )}
              <ErrorNote error={archive.error ?? remove.error} />
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Detail({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">{label}</p>
      <p className="truncate text-[13px] text-ink-900">{value || "—"}</p>
      {sub && <p className="truncate text-[12px] text-ink-500">{sub}</p>}
    </div>
  );
}

/**
 * The front elevation of the property. It is uploaded against the property
 * rather than any one inspection, and becomes the cover photograph on every
 * report view and PDF produced for it.
 */
/**
 * The property's front elevation, cut into the top-right corner of the header
 * card as a quarter-round disc — the same semi-circular treatment the report
 * cover and the PDF use, so a property reads as its own photograph at a glance.
 */
function CornerPhoto({ url, fullUrl }: { url: string; fullUrl: string | null }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 size-52 rounded-full bg-brand-100/70 blur-2xl"
      />
      <a
        href={fullUrl ?? url}
        target="_blank"
        rel="noreferrer"
        title="Open the full-size photograph"
        className="group absolute top-0 right-0 z-10 size-[96px] overflow-hidden rounded-bl-[999px] bg-ink-100 ring-2 ring-white shadow-[0_12px_34px_-14px_rgba(18,6,92,0.55)] sm:size-[148px]"
      >
        <img
          src={url}
          alt="Front of the property"
          className="size-full object-cover transition duration-500 group-hover:scale-[1.06]"
        />
        <span className="absolute inset-0 bg-gradient-to-bl from-brand-900/25 via-transparent to-transparent transition group-hover:from-brand-900/10" />
        <span className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full bg-white/90 text-brand-800 opacity-0 transition group-hover:opacity-100 sm:top-4 sm:right-4">
          <Expand className="size-3.5" />
        </span>
      </a>
    </>
  );
}

function FrontPhoto({
  propertyId,
  url,
  fullUrl,
  updatedAt,
}: {
  propertyId: string;
  url: string | null;
  fullUrl: string | null;
  updatedAt: Date | null;
}) {
  const upload = useUploadFrontPhoto();
  const remove = useRemoveFrontPhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    upload.mutate({ propertyId, file });
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Front of the property</SectionTitle>
        <div className="flex items-center gap-1.5">
          {url && (
            <Button
              size="sm"
              variant="ghost"
              className="text-ink-500 hover:text-danger"
              disabled={remove.isPending || upload.isPending}
              onClick={() => remove.mutate({ propertyId })}
            >
              {remove.isPending ? <Spinner /> : <Trash2 className="size-4" />}
              Remove
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-ink-200"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {upload.isPending ? <Spinner /> : <Upload className="size-4" />}
            {url ? "Replace" : "Upload"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          aria-label="Choose a front photograph"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            accept(file);
          }}
        />
      </div>
      <ErrorNote error={upload.error ?? remove.error} className="mb-2" />

      <Card className="p-3">
        {url ? (
          <div className="flex items-center gap-3">
            <a
              href={fullUrl ?? url}
              target="_blank"
              rel="noreferrer"
              title="Open the full-size photograph"
              className="group relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-ink-100 ring-1 ring-brand-100"
            >
              <img src={url} alt="Front of the property" className="size-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-brand-900/0 text-white opacity-0 transition group-hover:bg-brand-900/30 group-hover:opacity-100">
                <Expand className="size-4" />
              </span>
            </a>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink-900">Cover photograph set</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                It sits in the top-right corner of this property and as the semi-circular cover image on every
                report view and PDF.
              </p>
              {updatedAt && <p className="mt-1.5 text-[12px] text-ink-500">Uploaded {formatDate(updatedAt)}</p>}
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              accept(e.dataTransfer.files?.[0]);
            }}
            className={`flex w-full flex-col items-center gap-2 rounded-[10px] border border-dashed px-4 py-8 text-center transition-colors ${
              dragging ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-500 hover:bg-brand-50/60"
            }`}
          >
            <span className="grid size-10 place-items-center rounded-full bg-brand-100 text-brand-800">
              {upload.isPending ? <Spinner /> : <ImagePlus className="size-5" />}
            </span>
            <span className="text-[13px] font-medium text-ink-900">
              {upload.isPending ? "Uploading…" : "Upload a front photo of the property"}
            </span>
            <span className="max-w-[340px] text-[12px] leading-relaxed text-ink-500">
              Used as the cover image on every report for this property. Drag an image here or click to choose one —
              landscape works best.
            </span>
          </button>
        )}
      </Card>
    </section>
  );
}

type Upcoming = {
  id: string;
  type: string;
  scheduledFor: Date;
  notes: string | null;
};

function Schedule({ propertyId, upcoming }: { propertyId: string; upcoming: Upcoming[] }) {
  const schedule = useScheduleInspection();
  const cancel = useCancelSchedule();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>("check_in");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <SectionTitle className="text-[15px]">Upcoming</SectionTitle>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          <CalendarPlus className="size-4" />
          Schedule
        </Button>
      </div>

      {open && (
        <form
          className="mt-3 flex flex-col gap-2.5 rounded-[10px] bg-brand-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return;
            schedule.mutate(
              {
                propertyId,
                type,
                scheduledFor: new Date(`${date}T09:00:00`).getTime(),
                notes: notes.trim() || null,
              },
              {
                onSuccess: () => {
                  setOpen(false);
                  setDate("");
                  setNotes("");
                },
              },
            );
          }}
        >
          <Field label="Inspection type">
            <Select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REPORT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Access details, key collection…"
              className="min-h-[64px]"
            />
          </Field>
          <ErrorNote error={schedule.error} />
          <Button type="submit" size="sm" disabled={schedule.isPending}>
            {schedule.isPending && <Spinner />}
            Add to schedule
          </Button>
        </form>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {upcoming.length === 0 ? (
          <p className="text-[13px] text-ink-500">Nothing scheduled.</p>
        ) : (
          upcoming.map((row) => (
            <div key={row.id} className="flex items-start gap-2.5 rounded-[10px] bg-ink-100/60 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink-900">
                  {REPORT_TYPE_LABELS[row.type as ReportType] ?? row.type}
                </p>
                <p className="text-[12px] text-ink-500">{formatDate(row.scheduledFor)}</p>
                {row.notes && <p className="mt-1 text-[12px] text-ink-700">{row.notes}</p>}
              </div>
              <button
                type="button"
                aria-label="Cancel"
                className="rounded-full p-1.5 text-ink-500 hover:bg-white hover:text-danger"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate({ id: row.id })}
              >
                <X className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
