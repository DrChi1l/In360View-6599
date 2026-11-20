import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useInvoices() {
  return useQuery(orpc.invoices.list.queryOptions({ staleTime: 5_000 }));
}

export function useInvoice(id: string) {
  return useQuery(orpc.invoices.get.queryOptions({ input: { id } }));
}

export function useInvoiceClients(enabled = true) {
  return useQuery(orpc.invoices.clients.queryOptions({ enabled, staleTime: 60_000 }));
}

export function useInvoiceCandidates(input: { clientUserId: string; month?: string; reportId?: string } | null) {
  return useQuery(
    orpc.invoices.candidates.queryOptions({
      input: input ?? { clientUserId: "" },
      enabled: Boolean(input?.clientUserId && (input.month || input.reportId)),
    }),
  );
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: orpc.invoices.key() });
}

export function useCreateInvoice() {
  const invalidate = useInvalidate();
  return useMutation(orpc.invoices.create.mutationOptions({ onSuccess: invalidate }));
}

export function useSetInvoiceStatus() {
  const invalidate = useInvalidate();
  return useMutation(orpc.invoices.setStatus.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveInvoice() {
  const invalidate = useInvalidate();
  return useMutation(orpc.invoices.remove.mutationOptions({ onSuccess: invalidate }));
}

/** Fetches the server-built PDF and saves it as a file. */
export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { filename, base64 } = await orpc.invoices.pdf.call({ id });
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  });
}
