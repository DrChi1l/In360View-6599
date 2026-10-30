import { useEffect, useState } from "react";
import { CloudOff, CloudUpload, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { queueStatus, retryFailed, subscribeQueue, type QueueStatus } from "../lib/photo-queue";

export function useQueueStatus() {
  const [status, setStatus] = useState<QueueStatus>(queueStatus);
  useEffect(() => subscribeQueue(setStatus), []);
  return status;
}

/** Persistent pill: Synced · Saving n · Offline n queued. See design.md §5. */
export function SyncIndicator({ className }: { className?: string }) {
  const status = useQueueStatus();
  const busy = status.pending > 0;

  if (!status.online) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-[12px] font-medium text-warn",
          className,
        )}
      >
        <CloudOff className="size-3.5" />
        Offline{busy ? ` · ${status.pending} queued` : ""}
      </span>
    );
  }

  if (status.failed > 0) {
    return (
      <button
        type="button"
        onClick={() => void retryFailed()}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-[12px] font-medium text-danger",
          className,
        )}
      >
        <RefreshCw className="size-3.5" />
        {status.failed} stuck · retry
      </button>
    );
  }

  if (busy) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[12px] font-medium text-brand-800",
          className,
        )}
      >
        <CloudUpload className="size-3.5 animate-pulse" />
        Uploading {status.pending}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-[12px] font-medium text-ok",
        className,
      )}
    >
      <Check className="size-3.5" />
      Synced
    </span>
  );
}
