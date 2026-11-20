import { useState } from "react";
import { Link } from "wouter";
import { CalendarPlus, Check, Receipt } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { BookingDialog } from "../components/booking-dialog";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/field";
import { EmptyState, ErrorNote, Loading } from "../components/empty-state";
import { usePortal } from "../queries/portal";
import { formatDate } from "../lib/format";
import { REPORT_TYPE_LABELS, type ReportType } from "../../api/lib/domain";
import { cn } from "@/lib/utils";

const money = (n: number) => `£${n.toFixed(2)}`;

type Step = { label: string; done: boolean };

/** A row of steps with the finished ones ticked: Requested → Booked in → In progress → Completed. */
function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span
            className={cn(
              "grid size-4 place-items-center rounded-full text-[10px]",
              s.done ? "bg-ok text-white" : "bg-ink-100 text-ink-500",
            )}
          >
            {s.done ? <Check className="size-3" /> : i + 1}
          </span>
          <span className={s.done ? "font-medium text-ink-900" : "text-ink-500"}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-ink-300">›</span>}
        </li>
      ))}
    </ol>
  );
}

const bookingSteps = (status: string): Step[] => [
  { label: "Requested", done: true },
  { label: "Booked in", done: status === "confirmed" || status === "done" },
  { label: "Completed", done: status === "done" },
];

const reportSteps = (status: string, doneRooms: number, rooms: number): Step[] => [
  { label: "Booked in", done: true },
  { label: rooms ? `In progress (${doneRooms}/${rooms} rooms)` : "In progress", done: true },
  { label: "Completed", done: status === "completed" || status === "signed" },
  { label: "Signed", done: status === "signed" },
];

export default function AgencyHome() {
  const portal = usePortal();
  const data = portal.data;
  const [booking, setBooking] = useState(false);
  const invoice = data?.latestInvoice;

  // Bookings that already became a report are shown through the report, not twice.
  const open = (data?.bookings ?? []).filter((b) => b.status === "new" || b.status === "confirmed" || b.status === "declined");

  return (
    <AppShell
      title={data?.account.companyName ?? data?.account.name ?? "Your portal"}
      subtitle="Follow your inspections and invoices"
      wide
      actions={
        <Button size="sm" className="h-9 rounded-[10px]" onClick={() => setBooking(true)}>
          <CalendarPlus className="size-4" />
          <span className="hidden sm:inline">Book new inspection</span>
          <span className="sm:hidden">Book</span>
        </Button>
      }
    >
      {portal.isLoading && <Loading />}
      <ErrorNote error={portal.error} />

      {data && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-ink-900">Latest invoice</h2>
            {invoice ? (
              <Link href={`/invoices/${invoice.id}`}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-[10px] bg-brand-100 text-brand-800">
                      <Receipt className="size-4.5" />
                    </span>
                    <span>
                      <span className="block font-semibold">Invoice #{invoice.number}</span>
                      <span className="block text-xs text-ink-500">
                        {formatDate(invoice.issueDate)} · {invoice.status === "paid" ? "Paid" : "Awaiting payment"}
                      </span>
                    </span>
                  </span>
                  <span className="font-semibold">{money(invoice.total)}</span>
                </Card>
              </Link>
            ) : (
              <Card className="p-4 text-sm text-ink-500">No invoices yet.</Card>
            )}
            {invoice && (
              <Link href="/invoices" className="mt-2 inline-block text-xs font-medium text-brand-800">
                See all invoices
              </Link>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-ink-900">Booking requests</h2>
            {open.length === 0 ? (
              <Card className="p-4 text-sm text-ink-500">No open requests. Use “Book new inspection”.</Card>
            ) : (
              <div className="space-y-2">
                {open.map((b) => (
                  <Card key={b.id} className="p-4">
                    <div className="font-semibold">{b.propertyAddress}</div>
                    <div className="text-xs text-ink-500">
                      {b.inspectionType ?? "Inspection"} ·{" "}
                      {b.status === "confirmed"
                        ? `Booked for ${b.confirmedDate ?? b.requestedDate} at ${b.confirmedTime ?? b.requestedTime}`
                        : `Requested for ${b.requestedDate} at ${b.requestedTime}`}{" "}
                      · Ref {b.reference}
                    </div>
                    {b.status === "declined" ? (
                      <p className="mt-2 text-xs text-warn">We could not do this time. Contact us to find another.</p>
                    ) : (
                      <Steps steps={bookingSteps(b.status)} />
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-ink-900">Inspections and history</h2>
            {data.reports.length === 0 ? (
              <EmptyState title="Your inspections will appear here once they have started." />
            ) : (
              <div className="space-y-2">
                {data.reports.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="font-semibold">{[r.addressLine1, r.city].filter(Boolean).join(", ")}</div>
                    <div className="text-xs text-ink-500">
                      {REPORT_TYPE_LABELS[r.type as ReportType] ?? r.type} · {formatDate(r.inspectionDate)}
                      {r.reference ? ` · ${r.reference}` : ""}
                    </div>
                    <Steps steps={reportSteps(r.status, Number(r.completedRooms), Number(r.roomCount))} />
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <BookingDialog
        open={booking}
        onClose={() => setBooking(false)}
        defaults={{ name: data?.account.name, email: data?.account.email, phone: data?.account.phone ?? undefined }}
      />
    </AppShell>
  );
}
