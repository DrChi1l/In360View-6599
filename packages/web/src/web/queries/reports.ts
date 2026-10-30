import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export type ReportFilters = {
  propertyId?: string;
  type?: "check_in" | "check_out" | "mid_term";
  status?: "draft" | "completed" | "signed";
  from?: number;
  to?: number;
};

export function useReports(filters: ReportFilters = {}) {
  return useQuery(
    orpc.reports.list.queryOptions({
      input: { ...filters, limit: 100 },
      staleTime: 10_000,
    }),
  );
}

/** The full report tree — rooms, items, photo thumbnails, signatures. */
export function useReport(id: string | undefined) {
  return useQuery(
    orpc.reports.get.queryOptions({
      input: { id: id ?? "" },
      enabled: Boolean(id),
      staleTime: 2_000,
    }),
  );
}

export function useBaseCandidates(propertyId: string | undefined) {
  return useQuery(
    orpc.reports.baseCandidates.queryOptions({
      input: { propertyId: propertyId ?? "" },
      enabled: Boolean(propertyId),
    }),
  );
}

export function useInvalidateReport() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    if (id) void queryClient.invalidateQueries({ queryKey: orpc.reports.get.key({ input: { id } }) });
    void queryClient.invalidateQueries({ queryKey: orpc.reports.list.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.dashboard.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.properties.key() });
  };
}

export function useCreateReport() {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.reports.create.mutationOptions({ onSuccess: (row) => invalidate(row?.id) }));
}

export function useUpdateReport() {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.reports.update.mutationOptions({ onSuccess: (row) => invalidate(row?.id) }));
}

export function useCompleteReport() {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.reports.complete.mutationOptions({ onSuccess: (row) => invalidate(row?.id) }));
}

export function useReopenReport() {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.reports.reopen.mutationOptions({ onSuccess: (row) => invalidate(row?.id) }));
}

export function useDeleteReport() {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.reports.remove.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useSaveMeters(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.reports.meters.save.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

export function useSaveKeys(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.reports.keys.save.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}
