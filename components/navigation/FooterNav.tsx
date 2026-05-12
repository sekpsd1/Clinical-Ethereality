"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleHeart, ShoppingBag, Stethoscope, UserRound } from "lucide-react";
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
    icon: MessageCircleHeart
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserRound
  }
] as const;

export function FooterNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-footer border-t border-border/80 bg-glass/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-footer backdrop-blur-glass"
    >
      <div className="mx-auto grid w-full max-w-mobile grid-cols-4 gap-1">
        {footerItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-nav px-1 text-[0.72rem] font-medium text-muted transition-colors",
                active && "bg-primary/10 text-primary-strong"
              )}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={2.1} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
