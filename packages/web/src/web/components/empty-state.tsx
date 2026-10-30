import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 px-6 py-14 text-center", className)}>
      <p className="max-w-sm text-[14px] text-ink-500">{title}</p>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

export function Loading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-14 text-[14px] text-ink-500", className)}>
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p className={cn("rounded-[10px] bg-danger-soft px-3 py-2 text-[13px] text-danger", className)}>{message}</p>
  );
}
