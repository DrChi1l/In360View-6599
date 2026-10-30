import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Public — the bookings behind a private emailed link. */
export function useMyBookings(token: string | undefined) {
  return useQuery({
    ...orpc.myBookings.list.queryOptions({ input: { token: token ?? "" } }),
    enabled: Boolean(token),
    retry: false,
    staleTime: 30_000,
  });
}

/** Public — emails a fresh "My bookings" link to an address that has bookings. */
export function useRequestBookingLink() {
  return useMutation(orpc.myBookings.requestLink.mutationOptions());
}
