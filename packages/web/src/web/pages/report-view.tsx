import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Download,
  FileText,
  Gauge,
  Images,
  KeyRound,
  Lock,
  Printer,
  Scale,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Expand,
} from "lucide-react";
import { Logo } from "../components/logo";
import { Button } from "../components/ui/button";
import { ErrorNote, Loading } from "../components/empty-state";
import { PhotoLightbox, type LightboxPhoto } from "../components/photo-lightbox";
import { orderReportPhotos } from "../lib/photo-order";
import {
  ChangePill,
  CleanlinessPill,
  ConditionPill,
  StatusPill,
} from "../components/status-pill";
import { useReport } from "../queries/reports";
import { formatDate, formatDateTime, fullAddress, pluralise } from "../lib/format";
import {
  CLEANLINESS_LABELS,
  CONDITION_LABELS,
  METER_TYPES,
  REPORT_TYPE_LABELS,
  type Cleanliness,
  type Condition,
  type ReportType,
} from "../../api/lib/domain";
import {
  DECLARATION,
  DISCLAIMER_INTRO,
  DISCLAIMER_POINTS,
  GUIDANCE_INTRO,
  GUIDANCE_NOTES,
  SAFETY_INTRO,
  SAFETY_NOTICES,
  TERMS,
  TERMS_INTRO,
  pickCoverPhoto,
} from "../../api/lib/legal";

const ROLE_LABELS: Record<string, string> = {
  clerk: "Inventory clerk",
  tenant: "Tenant",
  landlord: "Landlord",
  agent: "Agent",
};

/** Soft drop shadow used by every container on the page. */
const CARD =
  "rounded-[16px] bg-white ring-1 ring-ink-100 shadow-[0_1px_3px_rgba(20,18,31,0.07),0_16px_40px_-20px_rgba(18,6,92,0.30)] print:shadow-none print:ring-ink-200";

function meterLabel(type: string) {
  return METER_TYPES.find((m) => m.value === type)?.label ?? type;
}

function slug(name: string, id: string) {
  return `room-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id.slice(-4)}`;
}

/* ------------------------------------------------------------- primitives */

function Section({
  title,
  icon: Icon,
  children,
  id,
  meta,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  id?: string;
  meta?: React.ReactNode;
}) {
  return (
    <section id={id} className={`${CARD} px-6 py-6 sm:px-8 print:break-inside-avoid`}>
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-ink-100 pb-3">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-brand-800 uppercase">
          {Icon && <Icon className="size-3.5" />}
          {title}
        </h2>
        {meta && <span className="ml-auto text-[12px] text-ink-500">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-[10px] bg-brand-50/70 px-3 py-2.5 ring-1 ring-ink-100/80">
      <dt className="text-[10.5px] font-medium tracking-[0.08em] text-ink-500 uppercase">{label}</dt>
      <dd className="mt-1 text-[14px] leading-snug break-words text-ink-900">{value || "—"}</dd>
    </div>
  );
}

function Prose({ label, text }: { label: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div className="mt-4 rounded-[12px] bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
      <p className="text-[11px] font-medium tracking-[0.08em] text-ink-500 uppercase">{label}</p>
      <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap text-ink-900">{text}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-white px-3.5 py-2.5 ring-1 ring-ink-100 shadow-[0_1px_2px_rgba(20,18,31,0.06),0_8px_20px_-14px_rgba(18,6,92,0.35)] print:shadow-none">
      <span className="block text-[10.5px] font-medium tracking-[0.08em] text-ink-500 uppercase">{label}</span>
      <span className="mt-0.5 block text-[14px] font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function LegalPoint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[12px] bg-brand-50/60 px-4 py-3 ring-1 ring-ink-100/80 print:break-inside-avoid">
      <p className="text-[13px] font-semibold text-ink-900">{title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-700">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function ReportView({ id }: { id?: string }) {
  const query = useReport(id);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const data = query.data;

  const roomNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of data?.rooms ?? []) map.set(room.id, room.name);
    return map;
  }, [data]);

  /**
   * The cover photograph: the front elevation uploaded against the property
   * when there is one, otherwise the best guess from the inspection's own
   * photographs.
   */
  const coverPhoto = useMemo(
    () => data?.frontPhoto ?? pickCoverPhoto(data?.photos ?? [], (roomId) => roomNames.get(roomId)),
    [data, roomNames],
  );

  /**
   * Every photo the lightbox walks, in document order — front elevation, then
   * each room's own shots, then each item inside that room. An uploaded front
   * elevation is not a photo of the inspection, so it leads the list rather
   * than sitting inside a room.
   */
  const allPhotos = useMemo<LightboxPhoto[]>(
    () =>
      orderReportPhotos({
        frontPhoto: data?.frontPhoto ?? null,
        rooms: data?.rooms ?? [],
        photos: data?.photos ?? [],
      }),
    [data],
  );
  const photoIndexById = useMemo(() => {
    const map = new Map<string, number>();
    allPhotos.forEach((photo, index) => map.set(photo.id, index));
    return map;
  }, [allPhotos]);

  const photosByRoom = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>["photos"]>();
    for (const photo of data?.photos ?? []) {
      if (!photo.roomId) continue;
      const list = map.get(photo.roomId) ?? [];
      list.push(photo);
      map.set(photo.roomId, list);
    }
    return map;
  }, [data]);

  if (query.isLoading) {
    return (
      <div className="min-h-dvh bg-brand-50 py-16">
        <Loading />
      </div>
    );
  }
  if (query.error || !data) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <ErrorNote error={query.error ?? new Error("Report not found.")} />
        <Link href="/reports" className="mt-4 inline-block text-[14px] font-medium text-brand-800 underline">
          Back to reports
        </Link>
      </div>
    );
  }

  const { report, property, rooms, meters, keys, signatures, previousItems, pdfUrl } = data;
  const locked = Boolean(report.lockedAt);
  const typeLabel = REPORT_TYPE_LABELS[report.type as ReportType] ?? report.type;
  const itemTotal = rooms.reduce((sum, room) => sum + room.items.length, 0);
  const openPhoto = (photoId: string) => setLightbox(photoIndexById.get(photoId) ?? 0);

  return (
    <div className="min-h-dvh bg-brand-50 pb-20 print:bg-white print:pb-0">
      {/* toolbar — screen only */}
      <div className="sticky top-0 z-20 border-b border-ink-100 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[980px] items-center gap-2 px-4 py-3">
          <Link href={`/reports/${report.id}`}>
            <Button size="sm" variant="ghost" className="text-ink-700">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back to inspection</span>
            </Button>
          </Link>
          <span className="ml-auto" />
          {allPhotos.length > 0 && (
            <Button size="sm" variant="outline" className="border-ink-200" onClick={() => setLightbox(0)}>
              <Images className="size-4" />
              <span className="hidden sm:inline">All {allPhotos.length} photos</span>
            </Button>
          )}
          <Button size="sm" variant="outline" className="border-ink-200" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {pdfUrl && (
            <Button size="sm" asChild>
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <Download className="size-4" />
                <span className="hidden sm:inline">PDF</span>
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* the document */}
      <article className="mx-auto mt-6 max-w-[980px] space-y-5 px-3 sm:px-5 print:mt-0 print:max-w-none print:space-y-3 print:px-0">
        {/* ------------------------------------------------------------ cover */}
        <header
          className={`relative overflow-hidden bg-gradient-to-br from-white via-brand-50 to-brand-100/70 ${CARD} print:break-after-page`}
        >
          {/* front-of-property photograph, quarter disc in the top-right corner
              — the same motif the PDF cover and the property screen use */}
          {coverPhoto && (
            <button
              type="button"
              onClick={() => openPhoto(coverPhoto.id)}
              title="Open photograph"
              className="group absolute -top-6 -right-6 z-20 hidden size-[300px] overflow-hidden rounded-bl-[999px] ring-6 ring-white shadow-[0_18px_50px_-20px_rgba(18,6,92,0.5)] sm:block print:shadow-none"
            >
              <img
                src={coverPhoto.thumbUrl}
                alt="Front of the property"
                className="size-full object-cover transition duration-500 group-hover:scale-[1.05]"
              />
              <span className="absolute inset-0 bg-brand-900/0 transition group-hover:bg-brand-900/15" />
              <span className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-brand-800 uppercase opacity-0 transition group-hover:opacity-100 print:hidden">
                <Expand className="size-3" />
                Enlarge
              </span>
            </button>
          )}

          <div className="relative z-10 px-6 py-7 sm:px-9 sm:py-9">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <Logo size={26} withTagline />
              <div className="rounded-[10px] bg-white/80 px-3 py-2 text-right ring-1 ring-ink-100 sm:hidden">
                <p className="text-[10px] font-medium tracking-[0.12em] text-ink-500 uppercase">Reference</p>
                <p className="font-mono text-[13px] font-semibold text-brand-800">{report.reference ?? report.id}</p>
              </div>
            </div>

            <p className="mt-7 text-[11px] font-semibold tracking-[0.18em] text-brand-800 uppercase sm:mt-[190px]">
              {typeLabel} inventory report
            </p>
            <h1 className="mt-2 text-[26px] leading-[1.14] font-bold tracking-tight text-ink-900 sm:text-[32px]">
              {property.addressLine1}
            </h1>
            <p className="mt-1 text-[15px] text-ink-500">
              {[property.addressLine2, property.city, property.postcode].filter(Boolean).join(", ")}
            </p>

            <div className="mt-3 hidden items-baseline gap-2 sm:flex">
              <span className="text-[11px] font-medium tracking-[0.12em] text-ink-500 uppercase">Reference</span>
              <span className="font-mono text-[14px] font-semibold text-brand-800">
                {report.reference ?? report.id}
              </span>
            </div>

            {/* mobile cover photo */}
            {coverPhoto && (
              <button
                type="button"
                onClick={() => openPhoto(coverPhoto.id)}
                className="mt-5 block w-full overflow-hidden rounded-[12px] ring-1 ring-brand-100 sm:hidden"
              >
                <img
                  src={coverPhoto.thumbUrl}
                  alt="Front of the property"
                  className="aspect-16/9 w-full object-cover"
                />
              </button>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:max-w-[420px] sm:grid-cols-4">
              <Stat label="Inspected" value={formatDate(report.inspectionDate)} />
              <Stat label="Clerk" value={report.clerkName ?? "—"} />
              <Stat label="Rooms" value={rooms.length} />
              <Stat label="Items" value={itemTotal} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <StatusPill status={report.status} locked={locked} />
              <ConditionPill value={report.generalCondition} />
              <CleanlinessPill value={report.generalCleanliness} />
            </div>
          </div>
        </header>

        {locked && (
          <p className="flex items-center gap-2 rounded-[16px] bg-ok-soft px-6 py-3 text-[13px] font-medium text-ok ring-1 ring-ok/20 shadow-[0_1px_3px_rgba(20,18,31,0.07),0_16px_40px_-20px_rgba(18,6,92,0.30)] sm:px-8 print:shadow-none">
            <Lock className="size-3.5 shrink-0" />
            Signed and locked {formatDateTime(report.lockedAt)} — this is the final version of this report.
          </p>
        )}

        {/* property + parties */}
        <Section title="Property & inspection">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail label="Full address" value={fullAddress(property)} />
            <Detail label="Property reference" value={property.reference} />
            <Detail label="Property type" value={property.propertyType} />
            <Detail label="Furnishing" value={property.furnishing} />
            <Detail
              label="Accommodation"
              value={`${pluralise(property.bedrooms, "bedroom")} · ${pluralise(property.bathrooms, "bathroom")}`}
            />
            <Detail label="Inspection type" value={typeLabel} />
            <Detail label="Inspection date" value={formatDate(report.inspectionDate)} />
            <Detail label="Tenant present" value={report.tenantPresent ? "Yes" : "No"} />
            <Detail label="Landlord" value={property.landlordName} />
            <Detail label="Landlord email" value={property.landlordEmail} />
            <Detail label="Tenant" value={property.tenantName} />
            <Detail label="Tenant email" value={property.tenantEmail} />
            <Detail label="Weather" value={report.weather} />
            <Detail label="Prepared by" value={report.clerkEmail ?? report.clerkName} />
            <Detail label="Completed" value={formatDate(report.completedAt)} />
            <Detail label="Report status" value={locked ? "Signed · locked" : report.status} />
          </dl>
        </Section>

        {/* summary */}
        <Section title="Overall summary">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-[12px] bg-brand-50/70 px-4 py-3 ring-1 ring-ink-100/80">
              <p className="text-[11px] font-medium tracking-[0.08em] text-ink-500 uppercase">General condition</p>
              <p className="mt-1.5 text-[18px] font-semibold text-ink-900">
                {CONDITION_LABELS[report.generalCondition as Condition] ?? "—"}
              </p>
            </div>
            <div className="rounded-[12px] bg-brand-50/70 px-4 py-3 ring-1 ring-ink-100/80">
              <p className="text-[11px] font-medium tracking-[0.08em] text-ink-500 uppercase">General cleanliness</p>
              <p className="mt-1.5 text-[18px] font-semibold text-ink-900">
                {CLEANLINESS_LABELS[report.generalCleanliness as Cleanliness] ?? "—"}
              </p>
            </div>
          </div>
          <Prose label="Summary notes" text={report.summaryNotes} />
          <Prose label="Maintenance issues" text={report.maintenanceIssues} />
          <Prose label="Tenant observations" text={report.tenantObservations} />
        </Section>

        {/* contents */}
        {rooms.length > 0 && (
          <Section title="Contents" icon={FileText} meta={`${pluralise(rooms.length, "room")} · ${pluralise(itemTotal, "item")}`}>
            <ol className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {rooms.map((room, index) => (
                <li key={room.id} className="flex items-baseline gap-3 border-b border-dashed border-ink-100 py-1.5">
                  <span className="w-5 shrink-0 text-[12px] font-medium text-ink-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <a
                    href={`#${slug(room.name, room.id)}`}
                    className="text-[14px] font-medium text-brand-800 hover:underline"
                  >
                    {room.name}
                  </a>
                  <span className="ml-auto text-[12px] text-ink-500">{pluralise(room.items.length, "item")}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* rooms */}
        {rooms.map((room, index) => {
          const roomPhotos = photosByRoom.get(room.id) ?? [];
          return (
            <Section
              key={room.id}
              id={slug(room.name, room.id)}
              title={`${String(index + 1).padStart(2, "0")} — ${room.name}`}
              meta={`${pluralise(room.items.length, "item")} · ${pluralise(roomPhotos.length, "photo")}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <ConditionPill value={room.condition} />
                <CleanlinessPill value={room.cleanliness} />
              </div>
              {room.notes && (
                <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-wrap text-ink-700">{room.notes}</p>
              )}

              {room.items.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-[12px] ring-1 ring-ink-100">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-brand-50 text-[11px] font-semibold tracking-[0.08em] text-ink-500 uppercase">
                        <th className="px-3 py-2.5 font-semibold">Item</th>
                        <th className="w-12 px-3 py-2.5 font-semibold">Qty</th>
                        <th className="w-28 px-3 py-2.5 font-semibold">Condition</th>
                        <th className="w-32 px-3 py-2.5 font-semibold">Cleanliness</th>
                        <th className="px-3 py-2.5 font-semibold">Description & notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {room.items.map((item) => {
                        const previous = item.previousItemId ? previousItems[item.previousItemId] : undefined;
                        return (
                          <tr key={item.id} className="border-t border-ink-100 align-top">
                            <td className="px-3 py-3">
                              <span className="block text-[14px] font-medium text-ink-900">{item.name}</span>
                              {item.changeStatus && <ChangePill value={item.changeStatus} className="mt-1.5" />}
                            </td>
                            <td className="px-3 py-3 text-[14px] text-ink-700">{item.quantity}</td>
                            <td className="px-3 py-3">
                              {item.condition ? (
                                <ConditionPill value={item.condition} />
                              ) : (
                                <span className="text-[13px] text-ink-300">—</span>
                              )}
                              {previous && previous.condition && previous.condition !== item.condition && (
                                <span className="mt-1 block text-[11px] text-ink-500">
                                  was {CONDITION_LABELS[previous.condition as Condition] ?? previous.condition}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {item.cleanliness ? (
                                <CleanlinessPill value={item.cleanliness} />
                              ) : (
                                <span className="text-[13px] text-ink-300">—</span>
                              )}
                              {previous && previous.cleanliness && previous.cleanliness !== item.cleanliness && (
                                <span className="mt-1 block text-[11px] text-ink-500">
                                  was {CLEANLINESS_LABELS[previous.cleanliness as Cleanliness] ?? previous.cleanliness}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-[13px] leading-relaxed text-ink-700">
                              {item.description && <span className="block whitespace-pre-wrap">{item.description}</span>}
                              {item.notes && (
                                <span className="mt-1 block whitespace-pre-wrap text-ink-500">{item.notes}</span>
                              )}
                              {previous?.description && previous.description !== item.description && (
                                <span className="mt-1.5 block border-l-2 border-ink-200 pl-2 text-[12px] text-ink-500">
                                  At check-in: {previous.description}
                                </span>
                              )}
                              {!item.description && !item.notes && !previous?.description && "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {roomPhotos.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {roomPhotos.map((photo) => (
                    <figure
                      key={photo.id}
                      className="overflow-hidden rounded-[12px] bg-white ring-1 ring-ink-100 shadow-[0_1px_2px_rgba(20,18,31,0.06),0_10px_24px_-16px_rgba(18,6,92,0.4)] print:shadow-none"
                    >
                      <button
                        type="button"
                        onClick={() => openPhoto(photo.id)}
                        className="group relative block w-full cursor-zoom-in"
                        title="Open photograph"
                      >
                        <img
                          src={photo.thumbUrl}
                          alt={photo.caption ?? `${room.name} photograph`}
                          loading="lazy"
                          className="aspect-4/3 w-full bg-ink-100 object-cover"
                        />
                        <span className="absolute inset-0 grid place-items-center bg-ink-900/0 transition group-hover:bg-ink-900/35 print:hidden">
                          <Expand className="size-5 text-white opacity-0 transition group-hover:opacity-100" />
                        </span>
                      </button>
                      {photo.caption && (
                        <figcaption className="px-2 py-1.5 text-[11px] leading-snug text-ink-500">
                          {photo.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </Section>
          );
        })}

        {/* meters */}
        {meters.length > 0 && (
          <Section title="Meter readings" icon={Gauge}>
            <div className="overflow-hidden rounded-[12px] ring-1 ring-ink-100">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-brand-50 text-[11px] font-semibold tracking-[0.08em] text-ink-500 uppercase">
                    <th className="px-3 py-2.5 font-semibold">Meter</th>
                    <th className="px-3 py-2.5 font-semibold">Reading</th>
                    <th className="px-3 py-2.5 font-semibold">Serial number</th>
                    <th className="px-3 py-2.5 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {meters.map((meter) => (
                    <tr key={meter.id} className="border-t border-ink-100">
                      <td className="px-3 py-2.5 text-[14px] font-medium text-ink-900">{meterLabel(meter.meterType)}</td>
                      <td className="px-3 py-2.5 font-mono text-[14px] text-ink-900">{meter.reading || "—"}</td>
                      <td className="px-3 py-2.5 text-[13px] text-ink-700">{meter.serialNumber || "—"}</td>
                      <td className="px-3 py-2.5 text-[13px] text-ink-700">{meter.location || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* keys */}
        {keys.length > 0 && (
          <Section title="Keys" icon={KeyRound}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {keys.map((key) => (
                <li key={key.id} className="flex items-baseline gap-3 rounded-[10px] bg-brand-50/60 px-3 py-2.5 ring-1 ring-ink-100">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-800">
                    {key.quantity}
                  </span>
                  <span className="text-[14px] text-ink-900">{key.description}</span>
                  {key.notes && <span className="ml-auto text-[12px] text-ink-500">{key.notes}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* declaration & signatures */}
        <Section title="Declaration & signatures">
          <p className="max-w-[70ch] text-[13px] leading-relaxed text-ink-700">{DECLARATION}</p>
          {signatures.length === 0 ? (
            <p className="mt-4 rounded-[12px] border border-dashed border-ink-200 px-4 py-6 text-center text-[13px] text-ink-500">
              This report has not been signed yet.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {signatures.map((signature) => (
                <div
                  key={signature.id}
                  className="rounded-[12px] bg-white p-4 ring-1 ring-ink-100 shadow-[0_1px_2px_rgba(20,18,31,0.06),0_10px_24px_-16px_rgba(18,6,92,0.4)] print:shadow-none"
                >
                  <p className="text-[11px] font-medium tracking-[0.08em] text-ink-500 uppercase">
                    {ROLE_LABELS[signature.signerRole] ?? signature.signerRole}
                  </p>
                  <img
                    src={signature.url}
                    alt={`Signature of ${signature.signerName}`}
                    className="mt-2 h-20 w-full object-contain object-left"
                  />
                  <div className="mt-2 border-t border-ink-100 pt-2">
                    <p className="text-[14px] font-semibold text-ink-900">{signature.signerName}</p>
                    {signature.signerEmail && <p className="text-[12px] text-ink-500">{signature.signerEmail}</p>}
                    <p className="mt-1 text-[12px] text-ink-500">Signed {formatDateTime(signature.signedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* disclaimer */}
        <Section title="Disclaimer" icon={ShieldAlert}>
          <p className="max-w-[80ch] text-[13px] leading-relaxed text-ink-700">{DISCLAIMER_INTRO}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {DISCLAIMER_POINTS.map((point) => (
              <LegalPoint key={point.title} title={point.title} body={point.body} />
            ))}
          </div>
        </Section>

        {/* safety notices */}
        <Section title="Safety notices & regulations" icon={ShieldCheck}>
          <p className="max-w-[80ch] text-[13px] leading-relaxed text-ink-700">{SAFETY_INTRO}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {SAFETY_NOTICES.map((notice) => (
              <LegalPoint key={notice.title} title={notice.title} body={notice.body} />
            ))}
          </div>
        </Section>

        {/* terms */}
        <Section title="Terms & conditions" icon={Scale}>
          <p className="max-w-[80ch] text-[13px] leading-relaxed text-ink-700">{TERMS_INTRO}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {TERMS.map((term) => (
              <LegalPoint key={term.title} title={term.title} body={term.body} />
            ))}
          </div>
        </Section>

        {/* guidance notes */}
        <Section title="Guidance notes for landlords, tenants & adjudicators" icon={BookOpen}>
          <p className="max-w-[80ch] text-[13px] leading-relaxed text-ink-700">{GUIDANCE_INTRO}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {GUIDANCE_NOTES.map((note) => (
              <LegalPoint key={note.title} title={note.title} body={note.body} />
            ))}
          </div>
        </Section>

        {/* footer */}
        <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[16px] bg-white px-6 py-5 text-[12px] text-ink-500 ring-1 ring-ink-100 shadow-[0_1px_3px_rgba(20,18,31,0.07),0_16px_40px_-20px_rgba(18,6,92,0.30)] sm:px-8 print:shadow-none">
          <Logo size={18} />
          <span>{report.reference ?? report.id}</span>
          <span>
            {typeLabel} · {formatDate(report.inspectionDate)}
          </span>
          <span className="sm:ml-auto">
            {report.pdfGeneratedAt
              ? `PDF last generated ${formatDateTime(report.pdfGeneratedAt)}`
              : "No PDF generated yet"}
          </span>
        </footer>
      </article>

      {lightbox !== null && allPhotos.length > 0 && (
        <PhotoLightbox
          photos={allPhotos}
          index={Math.min(lightbox, allPhotos.length - 1)}
          onIndexChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
