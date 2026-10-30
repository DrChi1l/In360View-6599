import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { orpc } from "../lib/api";
import { enqueuePhoto, onPhotoUploaded, pendingFor, type QueuedPhoto } from "../lib/photo-queue";
import { usePhotos, useRemovePhoto, useUpdateCaption } from "../queries/photos";
import { useReport } from "../queries/reports";
import { orderReportPhotos } from "../lib/photo-order";
import { Spinner } from "./empty-state";
import { PhotoLightbox, type LightboxPhoto } from "./photo-lightbox";
import { Button } from "./ui/button";

type Scope = { reportId: string; roomId?: string | null; itemId?: string | null };

/** Local queue entries rendered as thumbnails until storage confirms them. */
function usePendingPhotos(scope: Scope) {
  const [pending, setPending] = useState<QueuedPhoto[]>([]);
  const reload = useCallback(() => {
    void pendingFor(scope.reportId, scope.roomId ?? null, scope.itemId ?? null).then(setPending);
  }, [scope.reportId, scope.roomId, scope.itemId]);

  useEffect(() => {
    reload();
    const off = onPhotoUploaded(() => reload());
    const timer = window.setInterval(reload, 4000);
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [reload]);

  return { pending, reload };
}

function QueuedThumb({ entry }: { entry: QueuedPhoto }) {
  const url = useMemo(() => URL.createObjectURL(entry.thumb), [entry.thumb]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-[10px] bg-ink-100">
      <img src={url} alt="" className="size-full object-cover opacity-70" />
      <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-full bg-brand-800/90 py-0.5 text-[10px] font-medium text-white">
        {entry.attempts >= 8 ? "Stuck" : <Loader2 className="size-3 animate-spin" />}
        {entry.attempts >= 8 ? null : "Saving"}
      </span>
    </div>
  );
}

export function PhotoGrid({
  scope,
  locked,
  className,
  columns = "grid-cols-3 md:grid-cols-6",
  emptyLabel = "No photos yet.",
}: {
  scope: Scope;
  locked?: boolean;
  className?: string;
  columns?: string;
  emptyLabel?: string;
}) {
  const queryClient = useQueryClient();
  const query = usePhotos(
    { reportId: scope.reportId, roomId: scope.roomId ?? undefined, itemId: scope.itemId ?? undefined },
    { limit: 60 },
  );
  const { pending, reload } = usePendingPhotos(scope);
  const [viewer, setViewer] = useState<{ index: number; ordered: boolean } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);

  useEffect(
    () =>
      onPhotoUploaded((reportId) => {
        if (reportId !== scope.reportId) return;
        void queryClient.invalidateQueries({ queryKey: orpc.photos.key() });
      }),
    [queryClient, scope.reportId],
  );

  /**
   * Opening a photo anywhere in an inspection slides through the whole
   * report — room by room, then item by item — rather than only the handful
   * in this one grid. The report query is already cached by the page, so the
   * ordered list costs nothing extra.
   */
  const report = useReport(scope.reportId);
  const ordered = useMemo(
    () =>
      orderReportPhotos({
        frontPhoto: report.data?.frontPhoto ?? null,
        rooms: report.data?.rooms ?? [],
        photos: report.data?.photos ?? [],
      }),
    [report.data],
  );

  // Room-level grids must not swallow the photos attached to their items.
  const photos = (query.data?.photos ?? []).filter((p) =>
    scope.itemId ? p.itemId === scope.itemId : scope.roomId ? p.itemId === null : true,
  );

  const removePhoto = useRemovePhoto(scope.reportId);
  const updateCaption = useUpdateCaption(scope.reportId);

  /**
   * A photo uploaded seconds ago may not be in the cached report yet, so the
   * viewer falls back to this grid's own list for it.
   */
  const scopeList = useMemo<LightboxPhoto[]>(
    () => photos.map((p) => ({ id: p.id, caption: p.caption, thumbUrl: p.thumbUrl })),
    [photos],
  );
  const viewerPhotos = viewer?.ordered ? ordered : scopeList;

  function openPhoto(id: string) {
    const index = ordered.findIndex((p) => p.id === id);
    if (index >= 0) return setViewer({ index, ordered: true });
    setViewer({ index: Math.max(0, scopeList.findIndex((p) => p.id === id)), ordered: false });
  }

  // Compression is pooled across workers, so hand it every file at once rather
  // than waiting for each one — a burst of 20 photos lands in about the time
  // the old sequential loop took for four.
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setBusy((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          await enqueuePhoto(file, {
            reportId: scope.reportId,
            roomId: scope.roomId ?? null,
            itemId: scope.itemId ?? null,
          });
        } catch {
          // A file the browser cannot decode is skipped; the rest still upload.
        } finally {
          setBusy((n) => Math.max(0, n - 1));
          reload();
        }
      }),
    );
    reload();
  }

  return (
    <div className={cn("min-w-0", className)}>
      {!locked && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => cameraRef.current?.click()}
            className="h-10 rounded-[10px] px-4"
          >
            <Camera className="size-4" />
            Take photo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="h-10 rounded-[10px] border-ink-200 px-4"
          >
            <ImagePlus className="size-4" />
            Upload
          </Button>
          {busy > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
              <Spinner /> compressing {busy}
            </span>
          )}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            aria-label="Take a photograph"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            aria-label="Choose photographs to upload"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {photos.length === 0 && pending.length === 0 ? (
        <p className="text-[13px] text-ink-500">{emptyLabel}</p>
      ) : (
        <div className={cn("grid gap-2", columns)}>
          {pending.map((entry) => (
            <QueuedThumb key={entry.id} entry={entry} />
          ))}
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => openPhoto(photo.id)}
              className="group relative aspect-square overflow-hidden rounded-[10px] bg-ink-100"
            >
              <img
                src={photo.thumbUrl}
                alt={photo.caption ?? "Inspection photo"}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition-transform duration-150 group-hover:scale-[1.03]"
              />
              {photo.caption && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-ink-900/60 px-1.5 py-1 text-left text-[10px] text-white">
                  {photo.caption}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {query.data?.nextOffset != null && (
        <p className="mt-2 text-[12px] text-ink-500">
          Showing the first {photos.length} photos of this section.
        </p>
      )}

      {viewer && viewerPhotos.length > 0 && (
        <PhotoLightbox
          photos={viewerPhotos}
          index={Math.min(viewer.index, viewerPhotos.length - 1)}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
          onDelete={
            locked
              ? undefined
              : (photo) => {
                  const last = viewerPhotos.length <= 1;
                  removePhoto.mutate(
                    { id: photo.id },
                    { onSuccess: () => last && setViewer(null) },
                  );
                }
          }
          deleting={removePhoto.isPending}
          onCaptionSave={
            locked
              ? undefined
              : (photo, caption) => updateCaption.mutate({ id: photo.id, caption })
          }
          savingCaption={updateCaption.isPending}
        />
      )}
    </div>
  );
}
