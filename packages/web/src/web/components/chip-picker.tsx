import { cn } from "@/lib/utils";
import {
  CHANGE_STATUSES,
  CHANGE_STATUS_LABELS,
  CLEANLINESS,
  CLEANLINESS_LABELS,
  CONDITIONS,
  CONDITION_LABELS,
} from "../../api/lib/domain";
import { cleanlinessTone, conditionTone } from "./status-pill";

type ChipPickerProps = {
  label?: string;
  value?: string | null;
  options: { value: string; label: string; tone: string }[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * The most-used control in the app: one tap sets condition or cleanliness.
 * Horizontal scrolling row so every option stays reachable on a phone.
 */
export function ChipPicker({ label, value, options, onChange, disabled, className }: ChipPickerProps) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">{label}</div>
      )}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(active ? null : option.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors duration-75 active:scale-[0.96] active:duration-0 disabled:opacity-50",
                active
                  ? cn(option.tone, "border-transparent ring-1 ring-inset ring-current")
                  : "border-ink-200 bg-white text-ink-700 hover:border-brand-500 hover:text-brand-800",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CONDITION_OPTIONS = CONDITIONS.map((value) => ({
  value,
  label: CONDITION_LABELS[value],
  tone: conditionTone(value),
}));

const CLEANLINESS_OPTIONS = CLEANLINESS.map((value) => ({
  value,
  label: CLEANLINESS_LABELS[value],
  tone: cleanlinessTone(value),
}));

const CHANGE_OPTIONS = CHANGE_STATUSES.map((value) => ({
  value,
  label: CHANGE_STATUS_LABELS[value],
  tone:
    value === "unchanged"
      ? "bg-ink-100 text-ink-700"
      : value === "changed"
        ? "bg-warn-soft text-warn"
        : value === "cleaning_required"
          ? "bg-bad-soft text-bad"
          : "bg-danger-soft text-danger",
}));

export function ConditionPicker(props: Omit<ChipPickerProps, "options">) {
  return <ChipPicker {...props} label={props.label ?? "Condition"} options={CONDITION_OPTIONS} />;
}

export function CleanlinessPicker(props: Omit<ChipPickerProps, "options">) {
  return <ChipPicker {...props} label={props.label ?? "Cleanliness"} options={CLEANLINESS_OPTIONS} />;
}

export function ChangeStatusPicker(props: Omit<ChipPickerProps, "options">) {
  return <ChipPicker {...props} label={props.label ?? "Change since check-in"} options={CHANGE_OPTIONS} />;
}
