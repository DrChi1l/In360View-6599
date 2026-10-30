import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "../lib/api";
import { prepareImage } from "../lib/images";

export function useProperties(input: { search?: string; includeArchived?: boolean } = {}) {
  return useQuery(
    orpc.properties.list.queryOptions({
      input: { search: input.search, includeArchived: input.includeArchived ?? false, limit: 100 },
      staleTime: 10_000,
    }),
  );
}

export function useProperty(id: string | undefined) {
  return useQuery(
    orpc.properties.get.queryOptions({
      input: { id: id ?? "" },
      enabled: Boolean(id),
      staleTime: 5_000,
    }),
  );
}

function useInvalidateProperties() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.properties.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.dashboard.key() });
  };
}

export function useCreateProperty() {
  const invalidate = useInvalidateProperties();
  return useMutation(orpc.properties.create.mutationOptions({ onSuccess: invalidate }));
}

export function useUpdateProperty() {
  const invalidate = useInvalidateProperties();
  return useMutation(orpc.properties.update.mutationOptions({ onSuccess: invalidate }));
}

export function useArchiveProperty() {
  const invalidate = useInvalidateProperties();
  return useMutation(orpc.properties.setArchived.mutationOptions({ onSuccess: invalidate }));
}

export function useDeleteProperty() {
  const invalidate = useInvalidateProperties();
  return useMutation(orpc.properties.remove.mutationOptions({ onSuccess: invalidate }));
}

function useInvalidateWithReports() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.properties.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.dashboard.key() });
    /* The cover photograph on every report of this property changes with it. */
    void queryClient.invalidateQueries({ queryKey: orpc.reports.key() });
  };
}

/**
 * Uploads a front elevation for the property: the image is downscaled to a
 * full-size and a thumbnail version in the browser, both are PUT straight to
 * storage, and only then is the property pointed at them.
 */
export function useUploadFrontPhoto() {
  const invalidate = useInvalidateWithReports();
  return useMutation({
    mutationFn: async (input: { propertyId: string; file: File }) => {
      const prepared = await prepareImage(input.file);
      const slot = await client.properties.frontPhotoPresign({
        propertyId: input.propertyId,
        contentType: "image/jpeg",
      });
      const put = async (url: string, body: Blob) => {
        const res = await fetch(url, { method: "PUT", body, headers: { "Content-Type": "image/jpeg" } });
        if (!res.ok) throw new Error(`The photograph could not be uploaded (${res.status}).`);
      };
      await Promise.all([put(slot.uploadUrl, prepared.full), put(slot.thumbUploadUrl, prepared.thumb)]);
      return client.properties.frontPhotoSet({
        propertyId: input.propertyId,
        storageKey: slot.storageKey,
        thumbKey: slot.thumbKey,
        width: prepared.width,
        height: prepared.height,
      });
    },
    onSuccess: invalidate,
  });
}

export function useRemoveFrontPhoto() {
  const invalidate = useInvalidateWithReports();
  return useMutation(orpc.properties.frontPhotoRemove.mutationOptions({ onSuccess: invalidate }));
}

export function useScheduleInspection() {
  const invalidate = useInvalidateProperties();
  return useMutation(orpc.properties.schedule.mutationOptions({ onSuccess: invalidate }));
}

export function useCancelSchedule() {
  const invalidate = useInvalidateProperties();
  return useMutation(orpc.properties.cancelSchedule.mutationOptions({ onSuccess: invalidate }));
}
