import type { LegalSection } from "../../api/lib/booking-terms";
import { cn } from "@/lib/utils";

/** Renders the shared booking terms / privacy notice content. */
export function LegalText({ sections, className }: { sections: LegalSection[]; className?: string }) {
  return (
    <div className={cn("grid gap-6 text-[14px] leading-relaxed text-ink-700", className)}>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`legal-${section.id}`} className="grid gap-2.5">
          <h4 id={`legal-${section.id}`} className="text-[15px] font-semibold text-ink-900">
            {section.title}
          </h4>
          {section.blocks.map((block, i) => {
            if (block.kind === "p") return <p key={i}>{block.text}</p>;
            if (block.kind === "list") {
              return (
                <ul key={i} className="grid list-disc gap-1.5 pl-5 marker:text-brand-500">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );
            }
            return (
              <div key={i} className="overflow-hidden rounded-[12px] border border-ink-200">
                <div className="hidden grid-cols-[1fr_1.4fr] gap-4 bg-canvas px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 sm:grid">
                  <span>{block.head[0]}</span>
                  <span>{block.head[1]}</span>
                </div>
                {block.rows.map(([left, right]) => (
                  <div
                    key={left}
                    className="grid gap-1 border-t border-ink-100 px-4 py-3 first:border-t-0 sm:grid-cols-[1fr_1.4fr] sm:gap-4 sm:first:border-t"
                  >
                    <p className="font-semibold text-ink-900">{left}</p>
                    <p>{right}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
