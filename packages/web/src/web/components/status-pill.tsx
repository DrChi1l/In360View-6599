import { cn } from "@/lib/utils";
import {
  CLEANLINESS_LABELS,
  CONDITION_LABELS,
  CHANGE_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  type Cleanliness,
  type Condition,
  type ChangeStatus,
  type ReportType,
} from "../../api/lib/domain";

const pill = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap";

export function StatusPill({
  status,
  locked,
  className,
}: {
  status: string;
  locked?: boolean | null;
  className?: string;
}) {
  const map: Record<string, string> = {
    draft: "bg-ink-100 text-ink-700",
    completed: "bg-good-soft text-good",
    signed: "bg-ok-soft text-ok",
  };
  const label = locked ? "Signed · locked" : status === "draft" ? "Draft" : status === "completed" ? "Completed" : "Signed";
  return <span className={cn(pill, map[status] ?? "bg-ink-100 text-ink-700", className)}>{label}</span>;
}

export function TypePill({ type, className }: { type: string; className?: string }) {
  return (
    <span className={cn(pill, "bg-brand-100 text-brand-800", className)}>
      {REPORT_TYPE_LABELS[type as ReportType] ?? type}
    </span>
  );
}

const CONDITION_TONE: Record<Condition, string> = {
  excellent: "bg-ok-soft text-ok",
  good: "bg-good-soft text-good",
  fair: "bg-warn-soft text-warn",
  poor: "bg-bad-soft text-bad",
  damaged: "bg-danger-soft text-danger",
  na: "bg-ink-100 text-ink-500",
};

const CLEANLINESS_TONE: Record<Cleanliness, string> = {
  clean: "bg-ok-soft text-ok",
  generally_clean: "bg-good-soft text-good",
  fair: "bg-warn-soft text-warn",
  poor: "bg-bad-soft text-bad",
  very_poor: "bg-danger-soft text-danger",
  na: "bg-ink-100 text-ink-500",
};

const CHANGE_TONE: Record<ChangeStatus, string> = {
  unchanged: "bg-ink-100 text-ink-700",
  changed: "bg-warn-soft text-warn",
  damaged: "bg-danger-soft text-danger",
  missing: "bg-danger-soft text-danger",
  cleaning_required: "bg-bad-soft text-bad",
};

export function conditionTone(value?: string | null) {
  return CONDITION_TONE[(value ?? "na") as Condition] ?? CONDITION_TONE.na;
}

export function cleanlinessTone(value?: string | null) {
  return CLEANLINESS_TONE[(value ?? "na") as Cleanliness] ?? CLEANLINESS_TONE.na;
}

export function ConditionPill({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return null;
  return (
    <span className={cn(pill, conditionTone(value), className)}>
      {CONDITION_LABELS[value as Condition] ?? value}
    </span>
  );
}

export function CleanlinessPill({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return null;
  return (
    <span className={cn(pill, cleanlinessTone(value), className)}>
      {CLEANLINESS_LABELS[value as Cleanliness] ?? value}
    </span>
  );
}

export function ChangePill({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return null;
  return (
    <span className={cn(pill, CHANGE_TONE[value as ChangeStatus] ?? CHANGE_TONE.unchanged, className)}>
      {CHANGE_STATUS_LABELS[value as ChangeStatus] ?? value}
    </span>
  );
}
