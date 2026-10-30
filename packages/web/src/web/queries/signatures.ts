import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useInvalidateReport } from "./reports";

export function useSignatures(reportId: string | undefined) {
  return useQuery(
    orpc.signatures.list.queryOptions({
      input: { reportId: reportId ?? "" },
      enabled: Boolean(reportId),
    }),
  );
}

/**
 * Signing touches both the signature list and the report itself (status, lockedAt),
 * so every signature mutation has to refresh both or the sign-off screen goes stale.
 */
function useInvalidateSignatures() {
  const queryClient = useQueryClient();
  const invalidateReport = useInvalidateReport();
  return (reportId?: string) => {
    void queryClient.invalidateQueries({ queryKey: orpc.signatures.key() });
    invalidateReport(reportId);
  };
}

export function useCreateSignature(reportId?: string) {
  const invalidate = useInvalidateSignatures();
  return useMutation(orpc.signatures.create.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

export function useRemoveSignature(reportId?: string) {
  const invalidate = useInvalidateSignatures();
  return useMutation(orpc.signatures.remove.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

/** Locks the report: status becomes signed and every mutation is refused after. */
export function useFinaliseReport(reportId?: string) {
  const invalidate = useInvalidateSignatures();
  return useMutation(orpc.signatures.finalise.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}
