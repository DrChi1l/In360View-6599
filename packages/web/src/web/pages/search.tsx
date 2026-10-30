import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Building2, FileText, Search as SearchIcon, X } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Card, Input, SectionTitle } from "../components/ui/field";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorNote, Spinner } from "../components/empty-state";
import { StatusPill, TypePill } from "../components/status-pill";
import { useGlobalSearch } from "../queries/search";
import { formatDate, shortAddress } from "../lib/format";

export default function SearchPage() {
  const [term, setTerm] = useState("");
  const query = useGlobalSearch(term);
  const ready = term.trim().length >= 2;
  const properties = query.data?.properties ?? [];
  const reports = query.data?.reports ?? [];
  const empty = ready && !query.isFetching && properties.length === 0 && reports.length === 0;
  const searchRef = useRef<HTMLInputElement>(null);

  // Land with the caret in the box — this page exists only to be typed into.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <AppShell title="Search" subtitle="Addresses, postcodes, tenants, landlords and references">
      <div className="flex flex-col gap-4">
        <Card className="p-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
            <Input
              ref={searchRef}
              value={term}
              placeholder="Search by address, postcode, tenant, landlord or reference"
              className="pl-9 pr-10"
              onChange={(event) => setTerm(event.target.value)}
            />
            {term && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                onClick={() => setTerm("")}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </Card>

        <ErrorNote error={query.error} />

        {!ready && (
          <Card>
            <EmptyState title="Type at least two characters to search across every property and inspection." />
          </Card>
        )}

        {ready && query.isFetching && (
          <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-ink-500">
            <Spinner />
            Searching…
          </div>
        )}

        {empty && (
          <Card>
            <EmptyState title={`Nothing matches “${term.trim()}”. Try a postcode or a surname.`} />
          </Card>
        )}

        {properties.length > 0 && (
          <section>
            <SectionTitle className="mb-2 text-[15px]">
              Properties <span className="text-ink-500">({properties.length})</span>
            </SectionTitle>
            <div className="flex flex-col gap-2">
              {properties.map((property) => (
                <Link key={property.id} href={`/properties/${property.id}`}>
                  <Card className="flex items-center gap-3 p-3 transition-colors hover:border-brand-500">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-100 text-brand-800">
                      <Building2 className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-medium text-ink-900">
                          {shortAddress(property)}
                        </span>
                        {property.archived && (
                          <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                            Archived
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-500">
                        {[property.city, property.reference, property.tenantName, property.landlordName]
                          .filter(Boolean)
                          .join(" · ") || "No further details"}
                      </span>
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {reports.length > 0 && (
          <section>
            <SectionTitle className="mb-2 text-[15px]">
              Inspections <span className="text-ink-500">({reports.length})</span>
            </SectionTitle>
            <div className="flex flex-col gap-2">
              {reports.map((report) => (
                <Link key={report.id} href={`/reports/${report.id}`}>
                  <Card className="flex items-center gap-3 p-3 transition-colors hover:border-brand-500">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-100 text-brand-800">
                      <FileText className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink-900">
                        {[report.addressLine1, report.postcode].filter(Boolean).join(" · ")}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <TypePill type={report.type} />
                        <StatusPill status={report.status} />
                        <span className="text-[12px] text-ink-500">
                          {report.reference ?? report.id} · {formatDate(report.inspectionDate)}
                        </span>
                      </span>
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
