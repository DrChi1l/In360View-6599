import * as React from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-[10px] border border-ink-200 bg-white px-3 text-[15px] text-ink-900 placeholder:text-ink-300 outline-none transition-colors focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/20 disabled:bg-ink-100 disabled:text-ink-500";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // Generic wrapper: the control it labels is supplied by the caller.
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      {...props}
      className={cn(
        "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500",
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input {...props} className={cn(controlBase, "h-11", className)} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(controlBase, "min-h-[88px] py-2.5 leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select {...props} className={cn(controlBase, "h-11 appearance-none bg-white pr-9", className)}>
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label?: string;
  /** Id of the control, so the label is announced with it. */
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1 text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("rounded-[14px] border border-ink-100 bg-white shadow-soft", className)}
    />
  );
}

export function SectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  // Generic wrapper: the heading text comes from the caller's children.
  // oxlint-disable-next-line jsx-a11y/heading-has-content
  return <h2 {...props} className={cn("text-[17px] font-semibold text-ink-900", className)} />;
}
