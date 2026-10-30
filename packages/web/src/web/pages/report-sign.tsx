import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, Eraser, FileDown, Lock, PenLine, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, Field, Input, SectionTitle, Textarea } from "../components/ui/field";
import { ErrorNote, Loading } from "../components/empty-state";
import { StatusPill, TypePill } from "../components/status-pill";
import { useReport } from "../queries/reports";
import {
  useCreateSignature,
  useFinaliseReport,
  useRemoveSignature,
  useSignatures,
} from "../queries/signatures";
import { useGeneratePdf, useReportPdf } from "../queries/documents";
import { formatDate, formatDateTime, shortAddress } from "../lib/format";

const ROLES = [
  { value: "clerk", label: "Inventory clerk", blurb: "The person who carried out this inspection." },
  { value: "tenant", label: "Tenant", blurb: "Agrees the record of condition on the date stated." },
  { value: "landlord", label: "Landlord", blurb: "Accepts the report on behalf of the property owner." },
  { value: "agent", label: "Letting agent", blurb: "Signs on behalf of the managing agency." },
] as const;

type Role = (typeof ROLES)[number]["value"];

const DEFAULT_STATEMENT =
  "I confirm that I have read this report and agree that it is an accurate record of the condition of the property on the date stated.";

/** Canvas signature pad — pointer events cover mouse, pen and touch. */
function SignaturePad({
  onChange,
  disabled,
}: {
  onChange: (hasInk: boolean) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1d1b3a";
  }, []);

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = position(event);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = position(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!inked.current) {
      inked.current = true;
      onChange(true);
    }
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    inked.current = false;
    onChange(false);
  }

  function toDataUrl() {
    return canvasRef.current?.toDataURL("image/png") ?? null;
  }

  // Expose the two imperative bits through the DOM node so the parent form can
  // read the drawing without a ref-forwarding dance.
  useEffect(() => {
    const canvas = canvasRef.current as (HTMLCanvasElement & { __pad?: unknown }) | null;
    if (!canvas) return;
    canvas.__pad = { clear, toDataUrl };
  });

  return (
    <div className="min-w-0">
      <div className="relative overflow-hidden rounded-[12px] border border-dashed border-ink-200 bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Signature pad — draw your signature here"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="block h-40 w-full touch-none"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[12px] text-ink-300">
          Sign above
        </span>
      </div>
      <div className="mt-2 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled}>
          <Eraser className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}

function padOf(node: HTMLElement | null) {
  const canvas = node?.querySelector("canvas") as (HTMLCanvasElement & { __pad?: { clear: () => void; toDataUrl: () => string | null } }) | null;
  return canvas?.__pad ?? null;
}

export default function ReportSign({ id }: { id?: string }) {
  const [, navigate] = useLocation();
  const report = useReport(id);
  const signatures = useSignatures(id);
  const create = useCreateSignature(id);
  const remove = useRemoveSignature(id);
  const finalise = useFinaliseReport(id);
  const pdf = useReportPdf(id);
  const generatePdf = useGeneratePdf();

  const [role, setRole] = useState<Role>("clerk");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [statement, setStatement] = useState(DEFAULT_STATEMENT);
  const [hasInk, setHasInk] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [padError, setPadError] = useState<string | null>(null);
  const padHost = useRef<HTMLDivElement>(null);

  if (report.isLoading) {
    return (
      <AppShell title="Sign off" back={id ? `/reports/${id}` : "/reports"}>
        <Loading />
      </AppShell>
    );
  }
  if (report.error || !report.data) {
    return (
      <AppShell title="Sign off" back={id ? `/reports/${id}` : "/reports"}>
        <ErrorNote error={report.error ?? new Error("Report not found.")} />
      </AppShell>
    );
  }

  const { report: row, property } = report.data;
  const locked = Boolean(row.lockedAt);
  const existing = signatures.data ?? [];
  const signedRoles = new Set(existing.map((s) => s.signerRole));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPadError(null);
    const pad = padOf(padHost.current);
    const dataUrl = pad?.toDataUrl();
    if (!dataUrl || !hasInk) {
      setPadError("Please sign in the box above before saving.");
      return;
    }
    if (!name.trim()) {
      setPadError("Please enter the signer's full name.");
      return;
    }
    await create.mutateAsync({
      reportId: row.id,
      signerRole: role,
      signerName: name.trim(),
      signerEmail: email.trim() ? email.trim() : null,
      statement: statement.trim() || DEFAULT_STATEMENT,
      imageBase64: dataUrl,
    });
    pad?.clear();
    setHasInk(false);
    setName("");
    setEmail("");
  }

  return (
    <AppShell
      title="Sign off"
      subtitle={`${shortAddress(property)} · ${row.reference ?? row.id}`}
      back={`/reports/${row.id}`}
      wide
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypePill type={row.type} />
              <StatusPill status={row.status} locked={locked} />
            </div>
            <p className="mt-2 text-[13px] text-ink-500">
              Inspection dated {formatDate(row.inspectionDate)}. Each party signs once — signing again
              replaces that party's signature until the report is locked.
            </p>
            {locked && (
              <p className="mt-3 flex items-start gap-2 rounded-[10px] bg-ok-soft px-3 py-2 text-[13px] text-ok">
                <Lock className="mt-0.5 size-4 shrink-0" />
                Locked on {formatDateTime(row.lockedAt)}. This report is now immutable — no rooms, items,
                photos or signatures can be changed.
              </p>
            )}
          </Card>

          {!locked && (
            <Card className="flex flex-col gap-4 p-4">
              <div>
                <SectionTitle>Capture a signature</SectionTitle>
                <p className="mt-0.5 text-[13px] text-ink-500">
                  Choose who is signing, then sign with a finger, stylus or mouse.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.map((option) => {
                  const active = role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={
                        active
                          ? "rounded-[12px] border border-brand-800 bg-brand-50 px-3 py-2.5 text-left ring-1 ring-brand-800"
                          : "rounded-[12px] border border-ink-200 bg-white px-3 py-2.5 text-left hover:border-brand-500"
                      }
                    >
                      <span className="flex items-center gap-1.5 text-[14px] font-medium text-ink-900">
                        {option.label}
                        {signedRoles.has(option.value) && <Check className="size-3.5 text-ok" />}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ink-500">{option.blurb}</span>
                    </button>
                  );
                })}
              </div>

              <form className="flex flex-col gap-4" onSubmit={submit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name">
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Jane Okafor"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Email (optional)" hint="Used when emailing the signed report.">
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@example.com"
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <Field label="Declaration">
                  <Textarea
                    value={statement}
                    onChange={(event) => setStatement(event.target.value)}
                    className="min-h-[70px]"
                  />
                </Field>

                <div ref={padHost}>
                  <SignaturePad onChange={setHasInk} />
                </div>

                {padError && <ErrorNote error={new Error(padError)} />}
                <ErrorNote error={create.error} />

                <Button type="submit" disabled={create.isPending}>
                  <PenLine className="size-4" />
                  {create.isPending
                    ? "Saving signature…"
                    : signedRoles.has(role)
                      ? `Replace ${ROLES.find((r) => r.value === role)?.label.toLowerCase()} signature`
                      : "Save signature"}
                </Button>
              </form>
            </Card>
          )}

          <section>
            <SectionTitle className="mb-2">Signatures on file</SectionTitle>
            {existing.length === 0 ? (
              <Card className="px-4 py-8 text-center text-[13px] text-ink-500">
                No signatures yet. At least one is required before the report can be locked.
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {existing.map((signature) => (
                  <Card key={signature.id} className="flex items-center gap-3 p-3">
                    <img
                      src={signature.url ?? ""}
                      alt={`${signature.signerName} signature`}
                      className="h-14 w-32 shrink-0 rounded-[8px] border border-ink-100 bg-white object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink-900">{signature.signerName}</p>
                      <p className="text-[12px] text-ink-500">
                        {ROLES.find((r) => r.value === signature.signerRole)?.label ?? signature.signerRole}
                        {" · "}
                        {formatDateTime(signature.signedAt)}
                      </p>
                      {signature.signerEmail && (
                        <p className="truncate text-[12px] text-ink-500">{signature.signerEmail}</p>
                      )}
                    </div>
                    {!locked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove signature"
                        className="text-danger hover:bg-danger-soft"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate({ id: signature.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
            <ErrorNote error={remove.error} className="mt-2" />
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-4">
            <SectionTitle className="text-[15px]">Report PDF</SectionTitle>
            <p className="text-[13px] text-ink-500">
              Generate the PDF before locking so the signed document matches what the parties agreed.
            </p>
            <Button
              variant="outline"
              disabled={generatePdf.isPending}
              onClick={() => generatePdf.mutate({ reportId: row.id })}
            >
              <FileDown className="size-4" />
              {generatePdf.isPending ? "Generating…" : pdf.data?.url ? "Regenerate PDF" : "Generate PDF"}
            </Button>
            {pdf.data?.url && (
              <a
                href={pdf.data.url}
                target="_blank"
                rel="noreferrer"
                className="text-center text-[13px] font-medium text-brand-800 hover:underline"
              >
                Open current PDF
              </a>
            )}
            <ErrorNote error={generatePdf.error} />
          </Card>

          {!locked ? (
            <Card className="flex flex-col gap-3 p-4">
              <SectionTitle className="text-[15px]">Lock the report</SectionTitle>
              <p className="text-[13px] text-ink-500">
                Locking marks the report signed and makes it permanently read-only. This cannot be undone.
              </p>
              {confirmLock ? (
                <div className="flex flex-col gap-2">
                  <Button
                    disabled={finalise.isPending || existing.length === 0}
                    onClick={async () => {
                      await finalise.mutateAsync({ reportId: row.id });
                      setConfirmLock(false);
                      navigate(`/reports/${row.id}`);
                    }}
                  >
                    <ShieldCheck className="size-4" />
                    {finalise.isPending ? "Locking…" : "Yes, lock permanently"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmLock(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  disabled={existing.length === 0}
                  onClick={() => setConfirmLock(true)}
                >
                  <Lock className="size-4" />
                  Lock report
                </Button>
              )}
              {existing.length === 0 && (
                <p className="text-[12px] text-ink-500">Add at least one signature first.</p>
              )}
              <ErrorNote error={finalise.error} />
            </Card>
          ) : (
            <Card className="flex flex-col gap-3 p-4">
              <SectionTitle className="text-[15px]">Locked</SectionTitle>
              <p className="text-[13px] text-ink-500">
                This report is a final, immutable record. Create a new inspection if circumstances change.
              </p>
              <Link
                href={`/properties/${property.id}`}
                className="text-[13px] font-medium text-brand-800 hover:underline"
              >
                Back to property
              </Link>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
