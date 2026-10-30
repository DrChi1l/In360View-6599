import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Everything the home screen shows, in one round trip. */
export function useDashboard(enabled = true) {
  return useQuery(orpc.dashboard.summary.queryOptions({ enabled, staleTime: 15_000 }));
}
