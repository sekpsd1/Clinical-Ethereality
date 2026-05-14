import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

type BottomSheetProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  dismissHref?: string;
  className?: string;
  contentClassName?: string;
  bottomClassName?: string;
};

export function BottomSheet({
  title,
  description,
  children,
  footer,
  open = true,
  dismissHref,
  className,
  contentClassName,
  bottomClassName
}: BottomSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <section
      aria-label={title}
      className={cn("fixed inset-x-0 z-[60] px-4", bottomClassName ?? "bottom-0 pb-[env(safe-area-inset-bottom)]")}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#142326]/20 backdrop-blur-[2px]" />
      <div
        className={cn(
          "mx-auto w-full max-w-mobile rounded-t-[32px] border border-white/50 bg-white/85 p-5 shadow-[0_-18px_54px_rgba(0,96,103,0.16)] backdrop-blur-[24px]",
          className
        )}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#bdc9ca]" />
        <div className="mb-5 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-extrabold leading-7 text-primary">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-[#3e494a]">{description}</p> : null}
          </div>
          {dismissHref ? (
            <Link
              href={dismissHref as Route}
              aria-label="Close bottom sheet"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f7f9fb] text-[#3e494a] shadow-sm active:scale-95"
            >
              <X aria-hidden="true" className="size-5" strokeWidth={2.4} />
            </Link>
          ) : null}
        </div>

        <div className={cn("space-y-3", contentClassName)}>{children}</div>
        {footer ? <div className="mt-5 border-t border-[#bdc9ca]/25 pt-4">{footer}</div> : null}
      </div>
    </section>
  );
}
