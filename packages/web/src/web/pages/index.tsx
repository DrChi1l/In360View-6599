import { Link } from "wouter";
import { Building2, CalendarClock, CameraIcon, FileText, Plus } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Card } from "../components/ui/field";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorNote, Loading } from "../components/empty-state";
import { StatusPill, TypePill } from "../components/status-pill";
import { useDashboard } from "../queries/dashboard";
import { formatDate, formatRelative, pluralise } from "../lib/format";
import { REPORT_TYPE_LABELS, type ReportType } from "../../api/lib/domain";

function Stat({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: number;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="flex h-full items-center gap-3 p-3.5 transition-shadow hover:shadow-md">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-100 text-brand-800">
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span className="tabular block text-[20px] font-bold leading-tight text-ink-900">{value}</span>
          <span className="block truncate text-[12px] text-ink-500">{label}</span>
        </span>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const dashboard = useDashboard();
  const data = dashboard.data;
  const firstName = (data?.user.name ?? "").split(" ")[0];

  return (
    <AppShell
      title={firstName ? `Hello, ${firstName}` : "Dashboard"}
      subtitle={data?.user.companyName ?? "In360View"}
      wide
      actions={
        <Link href="/properties/new">
          <Button size="sm" className="h-9 rounded-[10px]">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New property</span>
          </Button>
        </Link>
      }
    >
      {dashboard.isLoading && <Loading label="Loading your dashboard…" />}
      <ErrorNote error={dashboard.error} />

      {data && (
        <div className="rise grid gap-5">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Stat label="Active properties" value={data.properties.active} href="/properties" icon={Building2} />
            <Stat label="Draft inspections" value={data.reports.drafts} href="/reports?status=draft" icon={FileText} />
            <Stat label="Signed reports" value={data.reports.signed} href="/reports?status=signed" icon={FileText} />
            <Stat label="Photos captured" value={data.photos} href="/reports" icon={CameraIcon} />
          </div>

          <section>
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-ink-900">Recent inspections</h2>
              <Link href="/reports" className="text-[13px] font-medium text-brand-800 hover:underline">
                All reports
              </Link>
            </div>
            {data.recentReports.length === 0 ? (
              <Card>
                <EmptyState
                  title="No inspections yet. Add a property, then start a Check-In."
                  action={
                    <Link href="/properties/new">
                      <Button size="sm" className="rounded-[10px]">
                        <Plus className="size-4" />
                        Add a property
                      </Button>
                    </Link>
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {data.recentReports.map((report) => (
                  <Link key={report.id} href={`/reports/${report.id}`}>
                    <Card className="h-full p-3.5 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-ink-900">{report.addressLine1}</p>
                          <p className="text-[12px] text-ink-500">
                            {report.postcode} · {report.reference}
                          </p>
                        </div>
                        <StatusPill status={report.status} />
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <TypePill type={report.type} />
                        <span className="text-[12px] text-ink-500">
                          {report.completedRooms}/{report.roomCount} rooms ·{" "}
                          {pluralise(report.photoCount, "photo")} · {formatRelative(report.updatedAt)}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2.5 text-[15px] font-semibold text-ink-900">Upcoming inspections</h2>
            {data.upcoming.length === 0 ? (
              <Card className="px-4 py-5 text-[13px] text-ink-500">
                Nothing scheduled. You can book one from any property page.
              </Card>
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {data.upcoming.map((slot) => (
                  <Link key={slot.id} href={`/properties/${slot.propertyId}`}>
                    <Card className="flex h-full items-center gap-3 p-3.5 transition-shadow hover:shadow-md">
                      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-100 text-brand-800">
                        <CalendarClock className="size-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink-900">
                          {slot.addressLine1}
                        </span>
                        <span className="block text-[12px] text-ink-500">
                          {REPORT_TYPE_LABELS[slot.type as ReportType] ?? slot.type} ·{" "}
                          {formatDate(slot.scheduledFor)}
                        </span>
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
