import { useState } from "react";
import { Link } from "wouter";
import { Building2, Plus, Search as SearchIcon } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Card, Input } from "../components/ui/field";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorNote, Loading } from "../components/empty-state";
import { useProperties } from "../queries/properties";
import { formatDate, pluralise } from "../lib/format";

export default function Properties() {
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const properties = useProperties({ search: search.trim() || undefined, includeArchived });

  return (
    <AppShell
      title="Properties"
      subtitle={properties.data ? pluralise(properties.data.length, "property", "properties") : undefined}
      wide
      actions={
        <Link href="/properties/new">
          <Button size="sm" className="h-9 rounded-[10px]">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </Link>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Address, postcode, tenant or landlord"
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant={includeArchived ? "default" : "outline"}
          size="sm"
          className="h-11 shrink-0 rounded-[10px] border-ink-200 px-3.5 text-[13px]"
          onClick={() => setIncludeArchived((v) => !v)}
        >
          Archived
        </Button>
      </div>

      {properties.isLoading && <Loading label="Loading properties…" />}
      <ErrorNote error={properties.error} />

      {properties.data?.length === 0 && (
        <Card>
          <EmptyState
            title={
              search
                ? "No property matches that search."
                : "No properties yet. Add the first one to start an inventory."
            }
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
      )}

      <div className="grid gap-2.5 lg:grid-cols-2">
        {properties.data?.map((property) => (
          <Link key={property.id} href={`/properties/${property.id}`}>
            <Card className="flex h-full items-start gap-3 p-3.5 transition-shadow hover:shadow-md">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-100 text-brand-800">
                <Building2 className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[14px] font-semibold text-ink-900">{property.addressLine1}</p>
                  {property.archived && (
                    <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">
                      Archived
                    </span>
                  )}
                </div>
                <p className="truncate text-[12px] text-ink-500">
                  {[property.city, property.postcode].filter(Boolean).join(", ")}
                  {property.reference ? ` · ${property.reference}` : ""}
                </p>
                <p className="mt-2 text-[12px] text-ink-500">
                  {property.bedrooms} bed · {property.bathrooms} bath · {pluralise(property.reportCount, "report")}
                  {property.lastReportAt ? ` · last ${formatDate(property.lastReportAt)}` : ""}
                </p>
                {property.tenantName && (
                  <p className="mt-1 truncate text-[12px] text-ink-500">Tenant: {property.tenantName}</p>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
