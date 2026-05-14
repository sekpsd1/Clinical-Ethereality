"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  PackageCheck,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { cn } from "@/lib/design-system/variants";

const adminNavItems = [
  {
    label: "ภาพรวม",
    href: "/admin",
    icon: ShieldCheck
  },
  {
    label: "ผู้ใช้",
    href: "/admin/users",
    icon: UsersRound
  },
  {
    label: "ตาราง",
    href: "/admin/schedules",
    icon: CalendarClock
  },
  {
    label: "ชำระเงิน",
    href: "/admin/payments",
    icon: CreditCard
  },
  {
    label: "คำสั่งซื้อ",
    href: "/admin/orders",
    icon: PackageCheck
  },
  {
    label: "สต็อก",
    href: "/admin/inventory",
    icon: ClipboardCheck
  },
  {
    label: "Moderation",
    href: "/admin/moderation",
    icon: ShieldAlert
  },
  {
    label: "บันทึก",
    href: "/admin/audit",
    icon: ScrollText
  },
  {
    label: "ตรวจพร้อม",
    href: "/admin/compliance",
    icon: FileCheck2
  }
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-app text-text">
      <header className="sticky top-0 z-header border-b border-border/70 bg-white/85 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-topbar">
        <div className="mx-auto flex w-full max-w-mobile items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-primary">ผู้ดูแล</p>
            <h1 className="truncate font-headline text-xl font-bold text-text">งานปฏิบัติการคลินิก</h1>
          </div>
          <Link
            href="/admin/notifications"
            aria-label="การแจ้งเตือน"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Bell aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5">
        {children}
      </main>

      <nav
        aria-label="ผู้ดูแลระบบ"
        className="fixed inset-x-0 bottom-0 z-footer border-t border-white/30 bg-white/85 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-bottom-nav backdrop-blur-topbar"
      >
        <div className="mx-auto grid w-full max-w-mobile grid-cols-9 gap-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-[50px] flex-col items-center justify-center rounded-[14px] px-1 text-[10px] font-bold text-muted transition-colors",
                  isActive && "bg-primary/10 text-primary"
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
