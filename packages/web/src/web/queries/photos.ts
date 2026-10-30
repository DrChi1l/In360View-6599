import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useInvalidateReport } from "./reports";

/** Paged thumbnails — never every photo of an inspection at once. */
export function usePhotos(
  scope: { reportId?: string; roomId?: string; itemId?: string; propertyId?: string },
  options: { limit?: number; offset?: number; enabled?: boolean } = {},
) {
  const hasScope = Boolean(scope.reportId || scope.roomId || scope.itemId || scope.propertyId);
  return useQuery(
    orpc.photos.list.queryOptions({
      input: { ...scope, limit: options.limit ?? 60, offset: options.offset ?? 0 },
      enabled: hasScope && (options.enabled ?? true),
      staleTime: 5_000,
    }),
  );
}

/** Full-size URL, fetched only when a photo is opened. */
export function usePhotoFull(id: string | null) {
  return useQuery(
    orpc.photos.full.queryOptions({
      input: { id: id ?? "" },
      enabled: Boolean(id),
      staleTime: 60_000,
    }),
  );
}

export function useUpdateCaption(reportId?: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReport();
  return useMutation(
    orpc.photos.updateCaption.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.photos.key() });
        invalidate(reportId);
      },
    }),
  );
}

export function useRemovePhoto(reportId?: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReport();
  return useMutation(
    orpc.photos.remove.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.photos.key() });
        invalidate(reportId);
      },
    }),
  );
}
