import Image from "next/image";
import { Menu } from "lucide-react";

export function TopAppBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-header border-b border-[#eceef0] bg-white/70 backdrop-blur-topbar">
      <div className="mx-auto flex h-14 w-full max-w-mobile items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Menu aria-hidden="true" className="size-[18px] text-primary" strokeWidth={2.25} />
          <p className="font-display text-base font-extrabold tracking-normal text-primary">
            Clinical Ethereality
          </p>
        </div>
        <div className="relative size-8 overflow-hidden rounded-full border border-primary/10 p-px">
          <Image
            src="/images/profiles/current-user.png"
            alt="Current user profile"
            fill
            sizes="32px"
            className="object-cover"
          />
        </div>
      </div>
    </header>
  );
}
