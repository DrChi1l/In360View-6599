import { Download, Printer, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { ErrorNote, Loading } from "../components/empty-state";
import { useDownloadInvoicePdf, useInvoice, useRemoveInvoice, useSetInvoiceStatus } from "../queries/invoices";

const money = (n: number) => `£${n.toFixed(2)}`;
const dmy = (d: Date | string) => {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${x.getFullYear()}`;
};
const MIN_ROWS = 8;

/** The printed invoice. "Print / Save as PDF" prints only the sheet (see @media print). */
export default function InvoiceView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const q = useInvoice(id);
  const status = useSetInvoiceStatus();
  const remove = useRemoveInvoice();
  const download = useDownloadInvoicePdf();
  const inv = q.data;

  return (
    <AppShell
      title={inv ? `Invoice ${inv.number}` : "Invoice"}
      back="/invoices"
      wide
      actions={
        inv && (
          <div className="flex gap-2 print:hidden">
            <select
              aria-label="Status"
              className="rounded-lg border border-ink-200 px-2 text-sm"
              value={inv.status}
              onChange={(e) => status.mutate({ id, status: e.target.value as "draft" | "sent" | "paid" })}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </select>
            <Button size="sm" disabled={download.isPending} onClick={() => download.mutate(id)}>
              <Download className="size-4" /> {download.isPending ? "Preparing…" : "Download PDF"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm("Delete this invoice permanently?")) remove.mutate({ id }, { onSuccess: () => navigate("/invoices") });
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )
      }
    >
      <style>{`@media print{body *{visibility:hidden}#invoice-sheet,#invoice-sheet *{visibility:visible}#invoice-sheet{position:absolute;inset:0;margin:0;box-shadow:none}@page{size:A4;margin:0}}`}</style>
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} />}
      {download.error && <ErrorNote error={download.error} />}
      {inv && (
        <div
          id="invoice-sheet"
          className="mx-auto w-full max-w-[794px] bg-white p-10 text-[#3a3a3a] shadow-md"
          style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
        >
          <img src="/images/logo-full.png" alt="In360View" className="h-16 w-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
          <h1 className="my-10 text-center text-4xl font-bold tracking-[0.2em]">INVOICE</h1>

          <div className="flex justify-between text-sm">
            <div>
              <div className="font-bold tracking-[0.15em]">ISSUED TO:</div>
              <div className="mt-1 whitespace-pre-line tracking-wider">
                {inv.clientName}
                {inv.clientAddress ? `\n${inv.clientAddress}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div>
                <span className="font-bold tracking-[0.15em]">INVOICE NO:</span>
                <span className="ml-6 font-bold">{inv.number}</span>
              </div>
              <div className="mt-6 tracking-wider">DATE: &nbsp; {dmy(inv.issueDate)}</div>
            </div>
          </div>

          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#12065C] text-left text-lg font-normal text-white">
                <th className="w-10 p-3" />
                <th className="p-3 font-normal">Description</th>
                <th className="p-3 font-normal">Rate</th>
                <th className="p-3 text-center font-normal">Qty</th>
                <th className="p-3 font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(MIN_ROWS, inv.lines.length) }, (_, i) => {
                const l = inv.lines[i];
                return (
                  <tr key={i} className="h-12 border border-ink-200">
                    <td className="border border-ink-200 px-2 text-xs">{i + 1}.</td>
                    <td className="border border-ink-200 px-3">{l?.description}</td>
                    <td className="border border-ink-200 px-3">{l && money(l.rate)}</td>
                    <td className="border border-ink-200 px-3 text-center">{l?.qty}</td>
                    <td className="border border-ink-200 px-3">{l && money(l.rate * l.qty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2 flex justify-end gap-8 border-t border-ink-300 pt-4 pr-3 text-sm font-bold tracking-widest">
            <span>TOTAL</span>
            <span>{money(inv.total)}</span>
          </div>

          <div className="mt-10 text-sm">
            <div className="font-bold tracking-[0.15em]">PAYMENT INFO:</div>
            <div className="mt-1 tracking-wider">
              {inv.paymentInfo.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
