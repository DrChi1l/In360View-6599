import { useState } from "react";
import { Link } from "wouter";
import { CalendarCheck2, CalendarClock, Check, Mail, MailCheck, MailWarning, MapPin, Phone, Send, Trash2, UserRound, X } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, Input, Label } from "../components/ui/field";
import { EmptyState, ErrorNote, Loading, Spinner } from "../components/empty-state";
import {
  useBookings,
  useConvertBooking,
  useDeleteBooking,
  useResendConfirmation,
  useUpdateBooking,
  type BookingStatus,
} from "../queries/bookings";
import { cn } from "@/lib/utils";
import { mapLink } from "../../api/lib/spain-address";
import { roomsSummary } from "../../api/lib/booking-rooms";

const TABS: { value: BookingStatus | "all"; label: string }[] = [
  { value: "new", label: "New" },
  { value: "confirmed", label: "Confirmed" },
  { value: "done", label: "Done" },
  { value: "declined", label: "Declined" },
  { value: "all", label: "All" },
];

const STATUS_TONE: Record<string, string> = {
  new: "bg-warn-soft text-warn",
  confirmed: "bg-ok-soft text-ok",
  done: "bg-brand-100 text-brand-800",
  declined: "bg-ink-100 text-ink-500",
};

function when(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const nice = new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${nice} · ${time}`;
}

export default function Bookings() {
  const [tab, setTab] = useState<BookingStatus | "all">("new");
  const list = useBookings(tab);
  const update = useUpdateBooking();
  const convert = useConvertBooking();
  const remove = useDeleteBooking();
  const resend = useResendConfirmation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which card has its "book in" or "decline" panel open. */
  const [panel, setPanel] = useState<{ id: string; kind: "confirm" | "decline" } | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string; propertyId?: string } | null>(null);

  const counts = list.data?.counts ?? {};

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title="Bookings"
      subtitle="Inspection requests submitted from your website"
      wide
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              tab === t.value
                ? "border-brand-800 bg-brand-800 text-white"
                : "border-ink-200 bg-white text-ink-700 hover:border-brand-500 hover:text-brand-800",
            )}
          >
            {t.label}
            {counts[t.value] ? <span className="ml-1.5 tabular-nums opacity-70">{counts[t.value]}</span> : null}
          </button>
        ))}
      </div>

      <ErrorNote error={error} className="mb-3" />
      {notice && (
        <output
          className={cn(
            "mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] px-3 py-2 text-[13px]",
            notice.tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
          )}
        >
          {notice.text}
          {notice.propertyId && (
            <Link href={`/properties/${notice.propertyId}`} className="font-semibold underline underline-offset-2">
              Open property →
            </Link>
          )}
        </output>
      )}

      {list.isLoading ? (
        <Loading />
      ) : !list.data?.bookings.length ? (
        <Card>
          <EmptyState title="No booking requests here yet. Requests from the website booking form land in this inbox." />
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.data.bookings.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
                        STATUS_TONE[b.status] ?? "bg-ink-100 text-ink-500",
                      )}
                    >
                      {b.status}
                    </span>
                    <span className="text-[12px] font-medium tabular-nums text-ink-500">{b.reference}</span>
                    <span className="text-[12px] text-ink-300">·</span>
                    <span className="text-[12px] text-ink-500">{b.inspectionType}</span>
                  </div>
                  <h2 className="mt-2 flex items-start gap-2 text-[16px] font-semibold text-ink-900">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-300" />
                    <span>
                      {b.propertyAddress}
                      {b.propertyCountry === "ES" && (
                        <span className="ml-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-800">
                          Spain
                        </span>
                      )}
                    </span>
                  </h2>
                  {b.propertyCountry === "ES" && b.propertyAddressEs && (
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-6 text-[12px] text-ink-500">
                      {b.propertyAddressEs.catastralRef && <span>Catastral ref (building): {b.propertyAddressEs.catastralRef}</span>}
                      {!b.propertyAddressEs.postalCode && <span>No postcode given</span>}
                      {mapLink(b.propertyAddressEs) && (
                        <a
                          href={mapLink(b.propertyAddressEs)!}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-brand-800 hover:underline"
                        >
                          Open map
                        </a>
                      )}
                    </p>
                  )}
                  {b.status === "confirmed" || b.status === "done" ? (
                    <>
                      <p className="mt-1.5 flex items-center gap-2 text-[13px] font-medium text-ok">
                        <CalendarCheck2 className="size-4" />
                        Booked in: {when(b.confirmedDate ?? b.requestedDate, b.confirmedTime ?? b.requestedTime)}
                      </p>
                      {(b.confirmedDate ?? b.requestedDate) !== b.requestedDate ||
                      (b.confirmedTime ?? b.requestedTime) !== b.requestedTime ? (
                        <p className="mt-0.5 pl-6 text-[12px] text-ink-500">
                          Requested {when(b.requestedDate, b.requestedTime)}
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          "mt-1 flex items-center gap-2 text-[12px]",
                          b.confirmationSentAt ? "text-ink-500" : "text-warn",
                        )}
                      >
                        {b.confirmationSentAt ? <MailCheck className="size-3.5" /> : <MailWarning className="size-3.5" />}
                        {b.confirmationSentAt
                          ? `Confirmation emailed ${new Date(b.confirmationSentAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                          : "Customer not emailed a confirmation yet"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1.5 flex items-center gap-2 text-[13px] font-medium text-brand-800">
                      <CalendarClock className="size-4" />
                      Requested: {when(b.requestedDate, b.requestedTime)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.status !== "confirmed" && b.status !== "done" && (
                    <Button
                      size="sm"
                      className="h-9 rounded-[9px]"
                      disabled={busy === b.id}
                      aria-expanded={panel?.id === b.id && panel.kind === "confirm"}
                      onClick={() => setPanel({ id: b.id, kind: "confirm" })}
                    >
                      <Check className="size-4" />
                      Book in & add property
                    </Button>
                  )}
                  {b.status === "confirmed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-[9px]"
                      disabled={busy === b.id}
                      onClick={() =>
                        void act(b.id, async () => {
                          const res = await resend.mutateAsync({ id: b.id });
                          setNotice(
                            res.emailed
                              ? { tone: "ok", text: `Confirmation emailed to ${b.contactEmail}.` }
                              : { tone: "warn", text: "The confirmation email could not be sent. Check the email settings." },
                          );
                        })
                      }
                    >
                      {busy === b.id ? <Spinner /> : <Send className="size-4" />}
                      {b.confirmationSentAt ? "Resend confirmation" : "Send confirmation"}
                    </Button>
                  )}
                  {b.status === "confirmed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-[9px]"
                      disabled={busy === b.id}
                      onClick={() => void act(b.id, () => update.mutateAsync({ id: b.id, status: "done" }))}
                    >
                      Mark done
                    </Button>
                  )}
                  {b.status !== "declined" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-[9px]"
                      disabled={busy === b.id}
                      aria-expanded={panel?.id === b.id && panel.kind === "decline"}
                      onClick={() => setPanel({ id: b.id, kind: "decline" })}
                    >
                      <X className="size-4" />
                      Decline
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete request"
                    className="size-9 text-ink-500 hover:text-danger"
                    disabled={busy === b.id}
                    onClick={() => void act(b.id, () => remove.mutateAsync({ id: b.id }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {panel?.id === b.id && (
                <ActionPanel
                  key={panel.kind}
                  kind={panel.kind}
                  booking={b}
                  busy={busy === b.id}
                  onCancel={() => setPanel(null)}
                  onSubmit={(v) =>
                    void act(b.id, async () => {
                      if (panel.kind === "confirm") {
                        const res = await convert.mutateAsync({
                          id: b.id,
                          confirmedDate: v.date,
                          confirmedTime: v.time,
                          notifyCustomer: v.notify,
                        });
                        setNotice({
                          tone: v.notify && !res.emailed ? "warn" : "ok",
                          text: `${b.reference} booked in for ${when(v.date, v.time)}. ${
                            !v.notify
                              ? "Customer not emailed."
                              : res.emailed
                                ? `Confirmation emailed to ${b.contactEmail}.`
                                : "The confirmation email could not be sent — use Send confirmation to retry."
                          } ${res.created ? "Property added." : "Property already existed."}`,
                          propertyId: res.propertyId,
                        });
                      } else {
                        const res = await update.mutateAsync({ id: b.id, status: "declined", notifyCustomer: v.notify });
                        setNotice({
                          tone: v.notify && !res.emailed ? "warn" : "ok",
                          text: `${b.reference} declined. ${
                            !v.notify ? "Customer not emailed." : res.emailed ? `${b.contactName} has been emailed.` : "The email to the customer could not be sent."
                          }`,
                        });
                      }
                      setPanel(null);
                    })
                  }
                />
              )}

              <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-3.5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-500">Contact</dt>
                  <dd className="mt-1 grid gap-1 text-ink-900">
                    <span className="flex items-center gap-1.5">
                      <UserRound className="size-3.5 text-ink-300" />
                      {b.contactName}
                    </span>
                    <a
                      href={`mailto:${b.contactEmail}`}
                      className="flex items-center gap-1.5 break-all text-brand-800 hover:underline"
                    >
                      <Mail className="size-3.5 text-ink-300" />
                      {b.contactEmail}
                    </a>
                    <a href={`tel:${b.contactPhone}`} className="flex items-center gap-1.5 text-brand-800 hover:underline">
                      <Phone className="size-3.5 text-ink-300" />
                      {b.contactPhone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-500">Tenant</dt>
                  <dd className="mt-1 grid gap-1 text-ink-900">
                    <span>{b.tenantName || "—"}</span>
                    {b.tenantEmail && <span className="break-all text-ink-500">{b.tenantEmail}</span>}
                    {b.tenantPhone && <span className="text-ink-500">{b.tenantPhone}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-500">Rooms</dt>
                  <dd className="mt-1 text-ink-900">{roomsSummary(b) ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-500">Furnishing</dt>
                  <dd className="mt-1 text-ink-900">{b.furnishing || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-500">Keys / access</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-ink-900">{b.accessNotes || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.08em] text-ink-500">Terms agreed</dt>
                  <dd className="mt-1 text-ink-900">
                    {b.termsAcceptedAt
                      ? `${new Date(b.termsAcceptedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${b.termsVersion}${b.locale === "es" ? " · shown in Spanish" : ""}`
                      : "Not recorded (booked before terms pop-up)"}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

type BookingItem = NonNullable<ReturnType<typeof useBookings>["data"]>["bookings"][number];

/** Inline step before booking in or declining: pick the slot and whether to email the customer. */
function ActionPanel({
  kind,
  booking,
  busy,
  onCancel,
  onSubmit,
}: {
  kind: "confirm" | "decline";
  booking: BookingItem;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: { date: string; time: string; notify: boolean }) => void;
}) {
  const [date, setDate] = useState(booking.confirmedDate ?? booking.requestedDate);
  const [time, setTime] = useState(booking.confirmedTime ?? booking.requestedTime);
  const [notify, setNotify] = useState(true);
  const confirm = kind === "confirm";
  const id = (s: string) => `${booking.id}-${s}`;

  return (
    <form
      className={cn(
        "mt-4 grid gap-3 rounded-[12px] border p-4",
        confirm ? "border-ok/30 bg-ok-soft/40" : "border-ink-200 bg-canvas",
      )}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ date, time, notify });
      }}
    >
      <p className="text-[14px] font-semibold text-ink-900">
        {confirm ? "Book this visit in" : "Decline this request"}
      </p>
      {confirm && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="grid gap-1">
            <Label htmlFor={id("date")}>Date</Label>
            <Input id={id("date")} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={id("time")}>Time</Label>
            <Input
              id={id("time")}
              type="time"
              step={900}
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
      )}
      <label className="flex items-start gap-2.5 text-[13px] text-ink-700">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-brand-800"
          aria-label={confirm ? "Email a confirmation to the customer" : "Email the customer"}
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
        />
        <span>
          {confirm ? "Email a confirmation (with calendar invite) to " : "Email the customer that we can't do this time — "}
          <strong className="break-all">{booking.contactEmail}</strong>
          {booking.locale === "es" ? " · sent in Spanish" : ""}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="h-9 rounded-[9px]" disabled={busy}>
          {busy ? <Spinner /> : confirm ? <Check className="size-4" /> : <X className="size-4" />}
          {confirm ? "Book in & add property" : "Decline request"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-9 rounded-[9px]" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
