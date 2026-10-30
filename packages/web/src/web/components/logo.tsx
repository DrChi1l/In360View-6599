import { cn } from "@/lib/utils";

type LogoProps = {
  /** Lockup height in px — the mark and the wordmark scale from this. */
  size?: number;
  tone?: "light" | "dark";
  withTagline?: boolean;
  className?: string;
};

/**
 * Composed lockup: `In` + the 360° orbit mark + `View`, so the wordmark can be
 * set white on indigo at any size. See design.md §2.
 */
export function Logo({ size = 28, tone = "dark", withTagline = false, className }: LogoProps) {
  const text = tone === "dark" ? "text-brand-800" : "text-white";
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span
        className={cn("inline-flex items-center font-extrabold tracking-tight leading-none", text)}
        style={{ fontSize: size }}
      >
        In
        <img
          src="/images/logo-mark.png"
          alt=""
          aria-hidden
          className="mx-[0.06em] inline-block"
          style={{ height: size * 1.04, width: size * 1.04 }}
        />
        View
      </span>
      {withTagline && (
        <span
          className={cn(
            "mt-1 font-medium uppercase",
            tone === "dark" ? "text-ink-500" : "text-white/70",
          )}
          style={{ fontSize: Math.max(8, size * 0.28), letterSpacing: "0.16em" }}
        >
          Inventories · Inspections · Floorplans
        </span>
      )}
      <span className="sr-only">In360View</span>
    </span>
  );
}
