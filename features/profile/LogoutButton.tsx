"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    await fetch("/api/auth/logout", {
      method: "POST"
    }).catch(() => undefined);

    window.location.replace("/auth/line?next=%2Fconsult%2Fassessment%3Fretake%3D1");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="inline-flex items-center gap-2 font-semibold text-[#ba1a1a] underline-offset-8 hover:underline disabled:opacity-60"
    >
      <LogOut aria-hidden="true" className="size-4" />
      {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
    </button>
  );
}
