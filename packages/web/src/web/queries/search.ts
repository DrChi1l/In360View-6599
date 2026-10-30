import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Global search across properties and reports. Idle until two characters are typed. */
export function useGlobalSearch(term: string, limit = 12) {
  const q = term.trim();
  return useQuery(
    orpc.search.global.queryOptions({
      input: { q, limit },
      enabled: q.length >= 2,
      staleTime: 5_000,
    }),
  );
}
