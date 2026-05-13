"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, ShoppingBag, Stethoscope, UserRound } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

const footerItems = [
  {
    label: "Consult",
    href: "/consult",
    icon: Stethoscope
  },
  {
    label: "Store",
    href: "/store",
    icon: ShoppingBag
  },
  {
    label: "Community",
    href: "/community",
    icon: MessageCircle
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserRound
  }
] as const;

export function FooterNav() {
  const pathname = usePathname();
  const usesCustomFooter =
    pathname.startsWith("/consult/payment") ||
    pathname.startsWith("/consult/waiting-room") ||
    pathname.startsWith("/consult/live") ||
    pathname.startsWith("/consult/prescriptions") ||
    pathname.startsWith("/consult/advice-log");

  if (usesCustomFooter) {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-footer rounded-t-[24px] border-t border-white/10 bg-white/70 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-bottom-nav backdrop-blur-topbar"
    >
      <div className="mx-auto grid w-full max-w-mobile grid-cols-4 gap-2">
        {footerItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[47px] flex-col items-center justify-center rounded-[16px] px-3 py-1 text-[10px] font-bold tracking-normal text-[#94a3b8] transition-colors",
                active && "bg-[#007b83]/10 px-4 text-primary"
              )}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
