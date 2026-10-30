import { useMutation } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useInvalidateReport } from "./reports";

export function useAddRoom(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.inspection.addRoom.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

export function useUpdateRoom(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.inspection.updateRoom.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

export function useRemoveRoom(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.inspection.removeRoom.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

export function useReorderRooms(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.inspection.reorderRooms.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

export function useAddItem(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.inspection.addItem.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

export function useUpdateItem(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.inspection.updateItem.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

export function useRemoveItem(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.inspection.removeItem.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}

/** One round trip for a whole room — the save the clerk actually taps. */
export function useSaveRoomBatch(reportId?: string) {
  const invalidate = useInvalidateReport();
  return useMutation(orpc.inspection.saveRoomBatch.mutationOptions({ onSuccess: () => invalidate(reportId) }));
}
