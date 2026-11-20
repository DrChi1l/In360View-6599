import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, Input, Label, Select } from "../components/ui/field";
import { EmptyState, ErrorNote, Loading } from "../components/empty-state";
import {
  useCreateInvoice,
  useInvoiceCandidates,
  useInvoiceClients,
  useInvoices,
} from "../queries/invoices";
import { useMe } from "../queries/account";
import { formatDate } from "../lib/format";

type Line = { reportId?: string | null; description: string; rate: number; qty: number };

const money = (n: number) => `£${n.toFixed(2)}`;
const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function Invoices() {
  const me = useMe();
  const list = useInvoices();
  const [creating, setCreating] = useState(false);

  const isAdmin = me.data?.role === "admin";

  return (
    <AppShell
      title="Invoices"
      subtitle={isAdmin ? "Bill a client for a month of jobs, or for a single job" : "Your invoices and payment history"}
      wide
      actions={
        isAdmin && (
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="size-4" />
            New invoice
          </Button>
        )
      }
    >
      {isAdmin && creating && <CreateInvoice onDone={() => setCreating(false)} />}
      {list.isLoading && <Loading />}
      {list.error && <ErrorNote error={list.error} />}
      {list.data && list.data.length === 0 && !creating && <EmptyState title="No invoices yet." />}
      <div className="space-y-2">
        {list.data?.map((inv) => (
          <Link key={inv.id} href={`/invoices/${inv.id}`}>
            <Card className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-semibold">
                  #{inv.number} · {inv.clientName}
                </div>
                <div className="text-xs text-ink-500">
                  {formatDate(inv.issueDate)} · {inv.kind === "month" ? `Month ${inv.periodMonth}` : inv.kind === "job" ? "Single job" : "Custom"} · {inv.status === "paid" ? "Paid" : inv.status === "sent" ? "Awaiting payment" : "Draft"}
                </div>
              </div>
              <div className="font-semibold">{money(inv.total)}</div>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

function CreateInvoice({ onDone }: { onDone: () => void }) {
  const [, navigate] = useLocation();
  const clients = useInvoiceClients();
  const create = useCreateInvoice();
  const [clientId, setClientId] = useState("");
  const [mode, setMode] = useState<"month" | "job">("month");
  const [month, setMonth] = useState(thisMonth());
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([]);

  // "Per job": list the client's jobs for the month and keep ticked only the ones to bill.
  const candidates = useInvoiceCandidates(clientId ? { clientUserId: clientId, month } : null);
  useEffect(() => {
    if (candidates.data) setLines(mode === "month" ? candidates.data.map(({ reportId, description, rate, qty }) => ({ reportId, description, rate, qty })) : []);
  }, [candidates.data, mode]);

  const picked = clients.data?.find((c) => c.id === clientId);
  useEffect(() => {
    if (picked) setClientName(picked.companyName || picked.name);
  }, [picked]);

  const total = lines.reduce((s, l) => s + l.rate * l.qty, 0);
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <Card className="mb-4 space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Client account</Label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select…</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName ? `${c.companyName} (${c.name})` : c.name || c.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Invoice type</Label>
          <Select value={mode} onChange={(e) => setMode(e.target.value as "month" | "job")}>
            <option value="month">Per month (all jobs)</option>
            <option value="job">Per job (pick jobs)</option>
          </Select>
        </div>
        <div>
          <Label>Month of the jobs</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div>
          <Label>Invoice date</Label>
          <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div>
          <Label>Issued to</Label>
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div>
          <Label>Client address</Label>
          <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="236-238 Ruislip Road, Greenford" />
        </div>
      </div>

      {mode === "job" && candidates.data && (
        <div>
          <Label>Jobs this month — tick the ones to bill</Label>
          <div className="space-y-1">
            {candidates.data.length === 0 && <p className="text-sm text-ink-500">No completed jobs this month.</p>}
            {candidates.data.map((c) => {
              const on = lines.some((l) => l.reportId === c.reportId);
              return (
                <label key={c.reportId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setLines((ls) =>
                        e.target.checked
                          ? [...ls, { reportId: c.reportId, description: c.description, rate: c.rate, qty: 1 }]
                          : ls.filter((l) => l.reportId !== c.reportId),
                      )
                    }
                  />
                  {c.description}
                </label>
              );
            })}
          </div>
        </div>
      )}
      {candidates.isLoading && <Loading />}

      <div>
        <Label>Lines</Label>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_60px_auto] gap-2">
              <Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
              <Input type="number" min={0} step="0.01" value={l.rate} onChange={(e) => setLine(i, { rate: Number(e.target.value) })} />
              <Input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Math.max(1, Number(e.target.value) || 1) })} />
              <Button size="sm" variant="outline" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setLines((ls) => [...ls, { description: "", rate: 0, qty: 1 }])}>
          <Plus className="size-3" /> Add line
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="font-semibold">Total {money(total)}</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={create.isPending || !clientName.trim() || lines.length === 0 || lines.some((l) => !l.description.trim())}
            onClick={() =>
              create.mutate(
                {
                  clientUserId: clientId || null,
                  clientName: clientName.trim(),
                  clientAddress: clientAddress.trim() || null,
                  issueDate: new Date(`${issueDate}T12:00:00Z`),
                  kind: mode === "month" ? "month" : "job",
                  periodMonth: month,
                  lines,
                },
                { onSuccess: (inv) => navigate(`/invoices/${inv.id}`) },
              )
            }
          >
            {create.isPending ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </div>
      {create.error && <ErrorNote error={create.error} />}
    </Card>
  );
}
