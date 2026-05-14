import Link from "next/link";
import type { Route } from "next";
import type { ComponentType } from "react";
import { ChevronRight } from "lucide-react";

type ProfileSettingsItemProps = {
  label: string;
  icon: ComponentType<{ className?: string; fill?: string }>;
  iconFill?: string;
  href?: string;
};

export function ProfileSettingsItem({ label, icon: Icon, iconFill = "none", href }: ProfileSettingsItemProps) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-6">
        <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#e8fbf7] text-primary">
          <Icon className="size-7" fill={iconFill} />
        </span>
        <span className="truncate text-left text-[18px] font-medium leading-6 text-[#3e494a]">{label}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-6 shrink-0 text-[#bdc9ca]" />
    </>
  );

  const className =
    "flex min-h-[118px] w-full items-center justify-between rounded-[24px] border border-white/40 bg-white/70 p-7 shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px] transition-colors hover:bg-white/90 active:scale-[0.98]";

  if (href) {
    return (
      <Link href={href as Route} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className}>
      {content}
    </button>
  );
}
