/** Short, sortable-ish unique ids for domain rows. */
export function newId(prefix: string) {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Human-facing report reference, e.g. CI-6K3P9Q. */
export function newReference(type: string) {
  const map: Record<string, string> = { check_in: "CI", check_out: "CO", mid_term: "MT" };
  const code = (map[type] ?? "RP").toUpperCase();
  const tail = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${code}-${tail}`;
}
