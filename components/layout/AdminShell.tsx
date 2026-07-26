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
import { LogoutButton } from "@/features/profile/LogoutButton";
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
    label: "ดูแลชุมชน",
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
      <aside className="fixed inset-y-0 left-0 z-header hidden w-64 flex-col border-r border-border/70 bg-white/90 px-4 py-6 backdrop-blur-topbar lg:flex">
        <div className="px-3">
          <p className="text-label font-bold uppercase text-primary">ผู้ดูแล</p>
          <h1 className="mt-1 font-headline text-xl font-bold text-text">งานปฏิบัติการคลินิก</h1>
        </div>

        <nav aria-label="เมนูผู้ดูแลระบบ" className="mt-7 flex flex-1 flex-col gap-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-[8px] px-3 text-sm font-bold text-muted transition-colors hover:bg-primary/5 hover:text-primary",
                  isActive && "bg-primary/10 text-primary"
                )}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.1} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <LogoutButton
          redirectTo="/auth/line?next=%2Fadmin"
          className="min-h-11 rounded-[8px] px-3 hover:bg-[#ba1a1a]/5 hover:no-underline"
        />
      </aside>

      <header className="sticky top-0 z-header border-b border-border/70 bg-white/85 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-topbar lg:ml-64 lg:px-8">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-primary lg:hidden">ผู้ดูแล</p>
            <h1 className="truncate font-headline text-xl font-bold text-text lg:text-2xl">
              <span className="lg:hidden">งานปฏิบัติการคลินิก</span>
              <span className="hidden lg:inline">ภาพรวมงานปฏิบัติการ</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/notifications"
              aria-label="การแจ้งเตือน"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Bell aria-hidden="true" className="size-5" strokeWidth={2.2} />
            </Link>
            <LogoutButton redirectTo="/auth/line?next=%2Fadmin" compact className="lg:hidden" />
          </div>
        </div>
      </header>

      <main className="flex min-h-dvh w-full flex-col px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 lg:pl-[18rem] lg:pr-8 lg:pb-8 lg:pt-7">
        <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
      </main>

      <nav
        aria-label="ผู้ดูแลระบบ"
        className="fixed inset-x-0 bottom-0 z-footer border-t border-white/30 bg-white/85 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-bottom-nav backdrop-blur-topbar lg:hidden"
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
