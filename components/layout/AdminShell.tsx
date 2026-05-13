import Link from "next/link";
import { Bell, ClipboardCheck, CreditCard, PackageCheck, ShieldCheck, UsersRound } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

const adminNavItems = [
  {
    label: "Overview",
    href: "/admin",
    icon: ShieldCheck,
    active: true
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: UsersRound,
    active: false
  },
  {
    label: "Payments",
    href: "/admin",
    icon: CreditCard,
    active: false
  },
  {
    label: "Orders",
    href: "/admin",
    icon: PackageCheck,
    active: false
  },
  {
    label: "Clinical",
    href: "/admin",
    icon: ClipboardCheck,
    active: false
  }
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-app text-text">
      <header className="sticky top-0 z-header border-b border-border/70 bg-white/85 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-topbar">
        <div className="mx-auto flex w-full max-w-mobile items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-primary">Admin</p>
            <h1 className="truncate font-headline text-xl font-bold text-text">Clinical Operations</h1>
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Bell aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5">
        {children}
      </main>

      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-footer border-t border-white/30 bg-white/85 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-bottom-nav backdrop-blur-topbar"
      >
        <div className="mx-auto grid w-full max-w-mobile grid-cols-5 gap-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "flex min-h-[50px] flex-col items-center justify-center rounded-[14px] px-1 text-[10px] font-bold text-muted transition-colors",
                  item.active && "bg-primary/10 text-primary"
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={2.1} />
                <span className="mt-0.5 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
