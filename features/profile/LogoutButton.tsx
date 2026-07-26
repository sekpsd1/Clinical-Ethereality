"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

type LogoutButtonProps = {
  redirectTo?: string;
  compact?: boolean;
  className?: string;
};

export function LogoutButton({
  redirectTo = "/auth/line?next=%2Fconsult%2Fassessment%3Fretake%3D1",
  compact = false,
  className
}: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    await fetch("/api/auth/logout", {
      method: "POST"
    }).catch(() => undefined);

    if (window.liff?.isInClient()) {
      window.liff.closeWindow();
      return;
    }

    window.liff?.logout();
    window.location.replace(redirectTo);
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      aria-label={compact ? "ออกจากระบบ" : undefined}
      title={compact ? "ออกจากระบบ" : undefined}
      className={cn(
        "inline-flex items-center gap-2 font-semibold text-[#ba1a1a] underline-offset-8 hover:underline disabled:opacity-60",
        compact && "size-11 justify-center rounded-full bg-[#ba1a1a]/10 hover:no-underline",
        className
      )}
    >
      <LogOut aria-hidden="true" className={compact ? "size-5" : "size-4"} />
      {!compact && (isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ")}
    </button>
  );
}
