/** UK-English formatting helpers shared by every screen. */

const DATE = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type Dateish = Date | string | number | null | undefined;

function toDate(value: Dateish): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: Dateish, fallback = "—") {
  const date = toDate(value);
  return date ? DATE.format(date) : fallback;
}

export function formatDateTime(value: Dateish, fallback = "—") {
  const date = toDate(value);
  return date ? DATE_TIME.format(date) : fallback;
}

/** "3 hours ago" / "in 2 days" — used on report rows and the dashboard. */
export function formatRelative(value: Dateish) {
  const date = toDate(value);
  if (!date) return "—";
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  if (abs < minute) return "just now";
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return DATE.format(date);
}

export function formatDateInput(value: Dateish) {
  const date = toDate(value) ?? new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export type AddressLike = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
};

export function shortAddress(property: AddressLike | null | undefined) {
  if (!property) return "—";
  return [property.addressLine1, property.postcode].filter(Boolean).join(" · ");
}

export function fullAddress(property: AddressLike | null | undefined) {
  if (!property) return "—";
  return [property.addressLine1, property.addressLine2, property.city, property.postcode]
    .filter(Boolean)
    .join(", ");
}

export function initials(name?: string | null) {
  if (!name) return "IV";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
