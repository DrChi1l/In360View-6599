import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Camera, FileDown, FileText, PenLine } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Card } from "../components/ui/field";
import { EmptyState, ErrorNote, Loading } from "../components/empty-state";
import { StatusPill, TypePill } from "../components/status-pill";
import { useReports, type ReportFilters } from "../queries/reports";
import { formatDate, formatRelative, shortAddress } from "../lib/format";
import { REPORT_STATUSES, REPORT_TYPES, REPORT_TYPE_LABELS, type ReportStatus, type ReportType } from "../../api/lib/domain";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ReportStatus, string> = {
  draft: "Drafts",
  completed: "Completed",
  signed: "Signed",
};

export default function Reports() {
  const search = useSearch();
  const initial = useMemo(() => new URLSearchParams(search), [search]);
  const [status, setStatus] = useState<ReportStatus | "all">(
    (initial.get("status") as ReportStatus | null) ?? "all",
  );
  const [type, setType] = useState<ReportType | "all">((initial.get("type") as ReportType | null) ?? "all");

  const filters: ReportFilters = {
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
    propertyId: initial.get("propertyId") ?? undefined,
  };
  const query = useReports(filters);

  return (
    <AppShell title="Reports" subtitle="Every inspection you have started" wide>
      <div className="mb-3 flex flex-col gap-2">
        <Filters
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            ...REPORT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          ]}
        />
        <Filters
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All types" },
            ...REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] })),
          ]}
        />
      </div>

      <ErrorNote error={query.error} className="mb-3" />

      {query.isLoading ? (
        <Loading />
      ) : !query.data?.length ? (
        <Card>
          <EmptyState title="No reports match these filters. Start an inspection from a property to create one." />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {query.data.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Card className="flex items-start gap-3 p-3.5 transition-colors hover:border-brand-500">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800">
                  <FileText className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink-900">
                    {shortAddress(report.property)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <TypePill type={report.type} />
                    <StatusPill status={report.status} locked={Boolean(report.lockedAt)} />
                    {report.pdfKey && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-1 text-[11px] font-medium text-ok">
                        <FileDown className="size-3" />
                        PDF
                      </span>
                    )}
                    {report.signatureCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-1 text-[11px] font-medium text-brand-800">
                        <PenLine className="size-3" />
                        {report.signatureCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-[12px] text-ink-500">
                    {report.reference ?? report.id} · {formatDate(report.inspectionDate)} ·{" "}
                    {report.completedRooms}/{report.roomCount} rooms
                    {report.photoCount > 0 && (
                      <>
                        {" · "}
                        <Camera className="mb-0.5 inline size-3" /> {report.photoCount}
                      </>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-500">{formatRelative(report.updatedAt)}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Filters<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value as T)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
            value === option.value
              ? "border-brand-800 bg-brand-800 text-white"
              : "border-ink-200 bg-white text-ink-700 hover:border-brand-500 hover:text-brand-800",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
