import { Link, useLocation } from "wouter";
import { CalendarClock, ChevronLeft, FileText, Home, Building2, Search, Tag, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMe } from "../queries/account";
import { initials } from "../lib/format";
import { Logo } from "./logo";
import { SyncIndicator } from "./sync-indicator";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/bookings", label: "Bookings", icon: CalendarClock },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/prices", label: "Price list", icon: Tag },
  { href: "/search", label: "Search", icon: Search },
  { href: "/account", label: "Account", icon: UserRound },
];

function isActive(current: string, href: string) {
  return href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);
}

function Sidebar() {
  const [location] = useLocation();
  const me = useMe();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-ink-100 bg-brand-50 px-3 py-5 md:flex">
      <Link href="/" className="mb-6 px-2">
        <Logo size={24} withTagline />
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(location, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors",
                active
                  ? "bg-brand-800 text-white"
                  : "text-ink-700 hover:bg-brand-100 hover:text-brand-800",
              )}
            >
              <item.icon className="size-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3 px-1">
        <SyncIndicator className="self-start" />
        <Link href="/account" className="flex items-center gap-2.5 rounded-[10px] px-2 py-2 hover:bg-brand-100">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-800 text-[12px] font-semibold text-white">
            {initials(me.data?.name ?? "")}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink-900">
              {me.data?.name ?? "Signed in"}
            </span>
            <span className="block truncate text-[11px] text-ink-500">{me.data?.companyName ?? me.data?.email}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

function BottomNav() {
  const [location] = useLocation();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-white/95 pt-1 backdrop-blur md:hidden">
      {NAV.map((item) => {
        const active = isActive(location, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-medium",
              active ? "text-brand-800" : "text-ink-500",
            )}
          >
            <item.icon className={cn("size-5", active && "stroke-[2.4]")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
  back,
  actions,
  wide,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: string;
  actions?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <div className="md:pl-60">
        <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/90 backdrop-blur">
          <div className={cn("mx-auto flex items-center gap-3 px-4 py-3", wide ? "max-w-6xl" : "max-w-4xl")}>
            {back ? (
              <Link
                href={back}
                aria-label="Back"
                className="-ml-1.5 grid size-9 shrink-0 place-items-center rounded-full text-ink-700 hover:bg-ink-100"
              >
                <ChevronLeft className="size-5" />
              </Link>
            ) : (
              <Link href="/" className="shrink-0 md:hidden">
                <Logo size={19} />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              {title && <h1 className="truncate text-[17px] font-semibold text-ink-900">{title}</h1>}
              {subtitle && <p className="truncate text-[12px] text-ink-500">{subtitle}</p>}
            </div>
            <SyncIndicator className="hidden sm:inline-flex md:hidden" />
            {actions}
          </div>
        </header>
        <main
          className={cn(
            "mx-auto px-4 pb-28 pt-4 md:pb-12",
            wide ? "max-w-6xl" : "max-w-4xl",
          )}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
