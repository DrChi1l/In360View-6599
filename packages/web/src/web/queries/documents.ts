import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** The stored PDF for a report, if one has been generated. */
export function useReportPdf(reportId: string | undefined) {
  return useQuery(
    orpc.documents.url.queryOptions({
      input: { reportId: reportId ?? "" },
      enabled: Boolean(reportId),
      staleTime: 60_000,
    }),
  );
}

export function useGeneratePdf(reportId?: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.documents.generate.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
        if (reportId) {
          void queryClient.invalidateQueries({ queryKey: orpc.reports.get.key({ input: { id: reportId } }) });
        }
        void queryClient.invalidateQueries({ queryKey: orpc.reports.list.key() });
      },
    }),
  );
}

export function useEmailReport() {
  return useMutation(orpc.documents.email.mutationOptions());
}
