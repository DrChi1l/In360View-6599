import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { type AuthMode, AuthPanel } from "./auth-panel";
import { cn } from "../lib/utils";

export function AuthDialog({
  open,
  onClose,
  initialMode = "signin",
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [mode, setMode] = useState<AuthMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      className={cn(
        "fixed inset-0 m-auto w-[92vw] max-w-md rounded-2xl border border-ink-100 bg-white p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        "animate-in fade-in zoom-in-95 duration-150",
      )}
    >
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <X className="size-4.5" />
        </button>
        <AuthPanel mode={mode} onModeChange={setMode} />
      </div>
    </dialog>
  );
}
