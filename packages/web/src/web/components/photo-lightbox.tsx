import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Input } from "./ui/field";
import { Button } from "./ui/button";

export type LightboxPhoto = {
  id: string;
  caption?: string | null;
  thumbUrl: string;
  fullUrl?: string;
  /** Free-text context shown beside the caption, e.g. the room name. */
  context?: string | null;
};

/** Past this much horizontal travel a drag counts as a swipe, not a wobble. */
const SWIPE_MIN = 56;

/**
 * Full-screen photo inspector: swipe or drag sideways to move through every
 * photograph in report order, arrow keys and buttons do the same, click or the
 * zoom control magnifies, Esc closes. Pass `onDelete` / `onCaptionSave` to let
 * the viewer edit the photograph it is showing.
 */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  onDelete,
  deleting,
  onCaptionSave,
  savingCaption,
}: {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete?: (photo: LightboxPhoto) => void;
  deleting?: boolean;
  onCaptionSave?: (photo: LightboxPhoto, caption: string | null) => void;
  savingCaption?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; width: number } | null>(null);
  /** Live drag distance — read at pointerup, where state would lag a frame. */
  const dragRef = useRef(0);
  /** True once a press has travelled far enough to be a swipe, not a tap. */
  const swiped = useRef(false);
  const photo = photos[index];
  const [caption, setCaption] = useState(photo?.caption ?? "");

  const step = useCallback(
    (delta: number) => {
      if (!photos.length) return;
      setZoomed(false);
      setDrag(0);
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, photos.length, onIndexChange],
  );

  useEffect(() => {
    setCaption(photo?.caption ?? "");
  }, [photo?.id, photo?.caption]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement | null)?.tagName === "INPUT";
      if (event.key === "Escape") onClose();
      if (typing) return;
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === " ") {
        event.preventDefault();
        setZoomed((z) => !z);
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, step]);

  if (!photo) return null;
  const src = photo.fullUrl ?? photo.thumbUrl;
  const prev = photos.length > 1 ? photos[(index - 1 + photos.length) % photos.length] : null;
  const next = photos.length > 1 ? photos[(index + 1) % photos.length] : null;

  /* ------------------------------------------------------------- gestures */

  function resetDrag() {
    dragRef.current = 0;
    setDrag(0);
    setDragging(false);
    start.current = null;
  }

  function onPointerDown(event: React.PointerEvent) {
    swiped.current = false;
    if (zoomed || photos.length < 2) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.clientWidth };
    dragRef.current = 0;
    setDragging(true);
    // Keep the gesture even if the finger leaves the stage mid-swipe.
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const from = start.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    // A mostly-vertical drag is a scroll, not a page turn — let it go.
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 24) {
      resetDrag();
      return;
    }
    if (Math.abs(dx) > 6) swiped.current = true;
    dragRef.current = dx;
    setDrag(dx);
  }

  function onPointerUp() {
    const from = start.current;
    const travelled = dragRef.current;
    resetDrag();
    if (!from) return;
    const threshold = Math.max(SWIPE_MIN, from.width * 0.16);
    if (travelled <= -threshold) step(1);
    else if (travelled >= threshold) step(-1);
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none flex-col border-0 bg-ink-900/92 p-0 backdrop-blur-sm print:hidden"
      aria-modal="true"
      aria-label="Photograph viewer"
    >
      {/* top bar */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-3 text-white/80 sm:px-6">
        <span className="text-[12px] font-medium tracking-[0.08em] uppercase">
          Photograph {index + 1} of {photos.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-white/80 hover:bg-white/10 hover:text-white"
              disabled={deleting}
              onClick={() => onDelete(photo)}
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          )}
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label={zoomed ? "Fit to screen" : "Zoom in"}
          >
            {zoomed ? <ZoomOut className="size-4.5" /> : <ZoomIn className="size-4.5" />}
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Open the original file"
          >
            <Download className="size-4.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* stage */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 select-none sm:px-16"
        style={{ touchAction: zoomed ? "auto" : "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => step(-1)}
            className="absolute left-1 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
            aria-label="Previous photograph"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        <div
          className={`h-full w-full ${zoomed ? "overflow-auto" : "grid place-items-center overflow-hidden"}`}
          style={
            zoomed
              ? undefined
              : {
                  transform: `translateX(${drag}px)`,
                  transition: dragging ? "none" : "transform 180ms cubic-bezier(0.2,0.8,0.2,1)",
                }
          }
        >
          <img
            src={src}
            alt={photo.caption ?? "Inspection photograph"}
            draggable={false}
            className={
              zoomed
                ? "max-w-none"
                : "max-h-full max-w-full rounded-[10px] object-contain shadow-2xl"
            }
            style={zoomed ? { width: "200%" } : undefined}
          />
        </div>

        {/* tap the picture itself to zoom in; the top bar fits it back */}
        {!zoomed && (
          <button
            type="button"
            onClick={() => {
              // A swipe that ends on the picture must not also zoom it.
              if (!swiped.current) setZoomed(true);
            }}
            aria-label="Zoom in"
            className="absolute inset-0 cursor-zoom-in"
          />
        )}

        {/* neighbours warmed up so a swipe lands on a photo, not a blank */}
        {prev && <img src={prev.fullUrl ?? prev.thumbUrl} alt="" aria-hidden className="hidden" />}
        {next && <img src={next.fullUrl ?? next.thumbUrl} alt="" aria-hidden className="hidden" />}

        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => step(1)}
            className="absolute right-1 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
            aria-label="Next photograph"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {/* caption + filmstrip */}
      <div className="shrink-0 px-4 pt-3 pb-4 sm:px-6">
        <p className="min-h-5 text-center text-[13px] leading-snug text-white/85">
          {photo.caption || photo.context || ""}
          {photo.caption && photo.context && <span className="text-white/45"> · {photo.context}</span>}
        </p>
        {photos.length > 1 && !onCaptionSave && (
          <p className="mt-1 text-center text-[11px] text-white/35 sm:hidden">Swipe to move through the report</p>
        )}

        {onCaptionSave && (
          <form
            className="mx-auto mt-3 flex w-full max-w-lg gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onCaptionSave(photo, caption.trim() || null);
            }}
          >
            <Input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Add a caption"
              className="h-10 border-white/20 bg-white/10 text-white placeholder:text-white/50"
            />
            <Button type="submit" size="sm" className="h-10 px-4" disabled={savingCaption}>
              Save
            </Button>
          </form>
        )}

        {photos.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setZoomed(false);
                  setDrag(0);
                  onIndexChange(i);
                }}
                className={`size-14 shrink-0 overflow-hidden rounded-[8px] border-2 transition ${
                  i === index ? "border-white" : "border-transparent opacity-55 hover:opacity-100"
                }`}
                aria-label={`Photograph ${i + 1}`}
              >
                <img src={p.thumbUrl} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
