import Link from "next/link";
import type { Route } from "next";
import type { NotificationType } from "@prisma/client";
import { CheckCircle2, Clock, Stethoscope, Tag } from "lucide-react";

type NotificationItemProps = {
  title: string;
  body: string;
  time: string;
  kind: NotificationType | "promo";
  unread: boolean;
  href: string;
};

export function NotificationItem({ title, body, time, kind, unread, href }: NotificationItemProps) {
  return (
    <Link
      href={href as Route}
      className={
        unread
          ? "relative block rounded-[24px] border border-primary/20 bg-white/65 p-5 shadow-[0_10px_30px_-10px_rgba(0,96,103,0.15)] backdrop-blur-[12px] transition-transform hover:-translate-y-0.5"
          : "block rounded-[24px] border border-white/40 bg-white/65 p-5 shadow-sm backdrop-blur-[12px] transition-colors hover:bg-white/80"
      }
    >
      {unread ? (
        <span aria-hidden="true" className="absolute -inset-px -z-10 rounded-[24px] bg-gradient-to-r from-primary/30 to-transparent blur-[2px]" />
      ) : null}

      <div className="flex gap-4">
        <span className="relative shrink-0">
          <NotificationAvatar kind={kind} />
          {unread ? (
            <span className="absolute -left-1 -top-1 size-3 rounded-full border-2 border-white bg-[#ba1a1a]" />
          ) : null}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <p className={unread ? "text-sm leading-7 text-[#191c1e]" : "text-sm leading-7 text-[#3e494a]"}>
            <span className={unread ? "font-bold text-primary" : "font-bold text-[#191c1e]"}>
              {title}
            </span>{" "}
            {body}
          </p>
          <div className="flex items-center gap-1.5 text-[#3e494a]/70">
            <Clock aria-hidden="true" className="size-3.5" />
            <span className="text-[11px] font-medium uppercase tracking-wide">{time}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function NotificationAvatar({ kind }: { kind: NotificationItemProps["kind"] }) {
  if (kind === "order" || kind === "payment" || kind === "prescription") {
    return (
      <span className="flex size-14 items-center justify-center rounded-full border-2 border-white bg-teal-50 text-primary shadow-sm">
        <Stethoscope aria-hidden="true" className="size-7" />
      </span>
    );
  }

  if (kind === "promo" || kind === "reward") {
    return (
      <span className="flex size-14 items-center justify-center rounded-full border-2 border-white bg-[#d4e4fc] text-[#617085] shadow-sm">
        <Tag aria-hidden="true" className="size-7" fill="#617085" />
      </span>
    );
  }

  if (kind === "community") {
    return (
      <span className="relative block size-14 overflow-hidden rounded-full border-2 border-white bg-[#27313a] shadow-sm">
        <span className="absolute left-[29%] top-[18%] size-[43%] rounded-full bg-[#c08c68]" />
        <span className="absolute left-[24%] top-[12%] h-[26%] w-[52%] rounded-t-full bg-[#1f2937]" />
        <span className="absolute bottom-0 left-[20%] h-[38%] w-[60%] rounded-t bg-[#1f2937]" />
      </span>
    );
  }

  return (
    <span className="relative block size-14 overflow-hidden rounded-full border-2 border-white bg-[#d7f6f2] shadow-sm">
      <span className="absolute left-[30%] top-[16%] size-[42%] rounded-full bg-[#e5b18a]" />
      <span className="absolute left-[26%] top-[12%] h-[34%] w-[50%] rounded-t-full bg-[#704035]" />
      <span className="absolute bottom-0 left-[18%] h-[34%] w-[64%] rounded-t bg-[#0f8f83]" />
      <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary text-white">
        <CheckCircle2 aria-hidden="true" className="size-4 fill-white text-primary" />
      </span>
    </span>
  );
}
