import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function usePortal(enabled = true) {
  return useQuery(orpc.portal.overview.queryOptions({ enabled, staleTime: 15_000 }));
}
