"use client";

import { FooterNav } from "@/components/navigation/FooterNav";
import { TopAppBar } from "@/components/layout/TopAppBar";
import { SafeArea } from "@/components/ui/SafeArea";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/design-system/variants";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hidesFooter = pathname.startsWith("/consult/live") || pathname.startsWith("/consult/assessment");
  const usesCustomCanvas =
    pathname.startsWith("/consult/assessment") ||
    pathname === "/notifications" ||
    pathname === "/community" ||
    pathname.startsWith("/community/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/store" ||
    pathname.startsWith("/store/");
  const usesFocusedHeader =
    usesCustomCanvas ||
    pathname.startsWith("/consult/assessment") ||
    pathname.startsWith("/consult/booking") ||
    pathname.startsWith("/consult/appointments") ||
    pathname.startsWith("/consult/payment") ||
    pathname.startsWith("/consult/waiting-room") ||
    pathname.startsWith("/consult/live") ||
    pathname.startsWith("/consult/prescriptions") ||
    pathname.startsWith("/consult/advice-log");

  return (
    <div className="min-h-dvh bg-app text-text">
      {usesFocusedHeader ? null : <TopAppBar />}
      <SafeArea
        as="main"
        horizontal={false}
        bottom={false}
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-mobile flex-col px-4",
          hidesFooter ? "pb-0" : "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
          usesCustomCanvas && "px-0",
          usesFocusedHeader ? "pt-0" : "pt-[calc(4rem+env(safe-area-inset-top))]"
        )}
      >
        {children}
      </SafeArea>
      {hidesFooter ? null : <FooterNav />}
    </div>
  );
}
