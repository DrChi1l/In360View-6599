import * as React from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./empty-state";

/**
 * A row that reveals a delete action when dragged right-to-left.
 *
 * Deliberately two-step: the swipe only uncovers the action, the delete
 * itself needs a deliberate tap. A clerk brushing a list on site should
 * never lose a room or an item by accident.
 *
 * The action button stays in the DOM at all times so keyboard users reach
 * it with Tab — focusing it slides the row open, blurring it closes again.
 */

const ACTION_W = 96;
const OPEN_AT = 44; // drag further than this to latch the row open
const ENGAGE = 8; // slop before a gesture counts as a horizontal swipe

export function SwipeRow({
  onDelete,
  label,
  actionLabel = "Delete",
  disabled = false,
  pending = false,
  className,
  contentClassName,
  children,
}: {
  onDelete: () => void;
  label: string;
  actionLabel?: string;
  disabled?: boolean;
  pending?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [drag, setDrag] = React.useState(0);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const axis = React.useRef<"none" | "x" | "y">("none");
  const dragRef = React.useRef(0);
  const swiped = React.useRef(false);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function reset() {
    start.current = null;
    axis.current = "none";
    dragRef.current = 0;
    setDrag(0);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    start.current = { x: event.clientX, y: event.clientY };
    axis.current = "none";
    swiped.current = false;
    dragRef.current = 0;
    setDrag(0);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const from = start.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (axis.current === "none") {
      if (Math.abs(dx) < ENGAGE && Math.abs(dy) < ENGAGE) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis.current === "x") event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (axis.current !== "x") return;
    swiped.current = true;
    dragRef.current = dx;
    setDrag(dx);
  }

  function onPointerUp() {
    const wasHorizontal = axis.current === "x";
    const dx = dragRef.current;
    reset();
    if (!wasHorizontal) return;
    if (open) {
      if (dx > OPEN_AT) setOpen(false);
    } else if (dx < -OPEN_AT) {
      setOpen(true);
    }
  }

  function onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    // A swipe must never also fire the row's own tap target, and a tap on an
    // open row just puts it back rather than navigating away.
    if (swiped.current || open) {
      event.preventDefault();
      event.stopPropagation();
      swiped.current = false;
      setOpen(false);
    }
  }

  const base = open ? -ACTION_W : 0;
  const offset = Math.min(0, Math.max(-ACTION_W, base + drag));
  const dragging = drag !== 0;

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      {!disabled && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_W }}>
          <button
            type="button"
            aria-label={label}
            disabled={pending}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={onDelete}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                event.currentTarget.blur();
              }
            }}
            className="flex flex-1 flex-col items-center justify-center gap-1 bg-danger text-white transition-colors duration-75 hover:bg-danger/90 active:scale-[0.97] active:duration-0 disabled:opacity-70"
          >
            {pending ? <Spinner /> : <Trash2 className="size-4" />}
            <span className="text-[11px] font-medium">{actionLabel}</span>
          </button>
        </div>
      )}
      <div
        className={cn(
          "relative touch-pan-y bg-white select-none",
          dragging ? undefined : "transition-transform duration-200 ease-out",
          contentClassName,
        )}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
