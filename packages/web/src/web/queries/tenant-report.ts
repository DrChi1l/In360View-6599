import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useTenantReport(token: string) {
  return useQuery(
    orpc.tenantReport.get.queryOptions({
      input: { token },
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: false,
    }),
  );
}
export function usePublishTenantReport() {
  return useMutation(orpc.tenantReport.publish.mutationOptions());
}
