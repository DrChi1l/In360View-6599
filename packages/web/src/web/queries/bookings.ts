import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export type BookingStatus = "new" | "confirmed" | "declined" | "done";

export function useBookings(status: BookingStatus | "all" = "all") {
  return useQuery(
    orpc.bookings.list.queryOptions({ input: { status, limit: 100 }, staleTime: 5_000 }),
  );
}

function useInvalidateBookings() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.bookings.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.properties.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.dashboard.key() });
  };
}

/** Public — used by the landing page booking form. */
export function useRequestBooking() {
  return useMutation(orpc.bookings.request.mutationOptions());
}

export function useUpdateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation(orpc.bookings.update.mutationOptions({ onSuccess: invalidate }));
}

export function useConvertBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation(orpc.bookings.convert.mutationOptions({ onSuccess: invalidate }));
}

export function useDeleteBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation(orpc.bookings.remove.mutationOptions({ onSuccess: invalidate }));
}

export function useResendConfirmation() {
  const invalidate = useInvalidateBookings();
  return useMutation(orpc.bookings.resendConfirmation.mutationOptions({ onSuccess: invalidate }));
}
