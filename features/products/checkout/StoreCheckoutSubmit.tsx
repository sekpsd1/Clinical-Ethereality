"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function StoreCheckoutSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mb-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient text-base font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(0,96,103,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : null}
      {pending ? "กำลังสร้างคำสั่งซื้อ" : "สร้างคำสั่งซื้อ"}
    </button>
  );
}
