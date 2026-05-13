import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Stethoscope, Tag } from "lucide-react";

type NotificationItem = {
  title: string;
  body: string;
  time: string;
  kind: "pharmacist" | "like" | "medical" | "promo";
  unread?: boolean;
  href: "/community/vitamin-c-tips" | "/store/payment-success" | "/store";
};

const notifications: NotificationItem[] = [
  {
    title: "เภสัชกร อริสรา",
    body: 'ได้ตอบกลับในกระทู้: "แชร์เคล็ดลับการทานวิตามินซี..."',
    time: "เมื่อ 2 นาทีที่แล้ว",
    kind: "pharmacist",
    unread: true,
    href: "/community/vitamin-c-tips"
  },
  {
    title: "K. Somchai",
    body: "และอีก 5 คน ถูกใจโพสต์ของคุณ",
    time: "เมื่อ 1 ชั่วโมงที่แล้ว",
    kind: "like",
    href: "/community/vitamin-c-tips"
  },
  {
    title: "คำสั่งซื้อเวชภัณฑ์ #MED-9942",
    body: "ของคุณจัดส่งสำเร็จแล้ว ตรวจสอบสถานะได้ทันที",
    time: "เมื่อ 5 ชั่วโมงที่แล้ว",
    kind: "medical",
    href: "/store/payment-success"
  },
  {
    title: "สิทธิพิเศษสำหรับคุณ!",
    body: "รับส่วนลด 15% สำหรับการตรวจสุขภาพประจำปี",
    time: "เมื่อวานนี้",
    kind: "promo",
    href: "/store"
  }
];

export function NotificationCenter() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#e0f2f1_0%,#f7f9fb_40%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <NotificationHeader />

      <main className="mx-auto w-full max-w-mobile px-6 pb-10 pt-[144px]">
        <section className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Latest Updates</p>
            <h1 className="mt-3 text-[32px] font-extrabold leading-tight text-primary">การแจ้งเตือน</h1>
          </div>
          <button type="button" className="border-b-2 border-primary/20 pb-1 text-sm font-bold text-primary">
            อ่านทั้งหมด
          </button>
        </section>

        <section className="space-y-6">
          {notifications.map((notification) => (
            <NotificationCard key={`${notification.title}-${notification.time}`} notification={notification} />
          ))}
        </section>
      </main>
    </div>
  );
}

function NotificationHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 px-6 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-[104px] w-full max-w-mobile items-center justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/profile" aria-label="Back to profile" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-7" strokeWidth={2.4} />
          </Link>
          <h1 className="truncate text-[28px] font-extrabold tracking-wide text-primary">การแจ้งเตือน</h1>
        </div>
        <button type="button" className="shrink-0 text-sm font-semibold text-primary">
          ทำเป็นอ่านแล้ว
        </button>
      </div>
    </header>
  );
}

function NotificationCard({ notification }: { notification: NotificationItem }) {
  return (
    <Link
      href={notification.href}
      className={
        notification.unread
          ? "relative block rounded-[24px] border border-primary/20 bg-white/65 p-5 shadow-[0_10px_30px_-10px_rgba(0,96,103,0.15)] backdrop-blur-[12px] transition-transform hover:-translate-y-0.5"
          : "block rounded-[24px] border border-white/40 bg-white/65 p-5 shadow-sm backdrop-blur-[12px] transition-colors hover:bg-white/80"
      }
    >
      {notification.unread ? (
        <span aria-hidden="true" className="absolute -inset-px -z-10 rounded-[24px] bg-gradient-to-r from-primary/30 to-transparent blur-[2px]" />
      ) : null}

      <div className="flex gap-4">
        <span className="relative shrink-0">
          <NotificationAvatar notification={notification} />
          {notification.unread ? (
            <span className="absolute -left-1 -top-1 size-3 rounded-full border-2 border-white bg-[#ba1a1a]" />
          ) : null}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <p className={notification.unread ? "text-sm leading-7 text-[#191c1e]" : "text-sm leading-7 text-[#3e494a]"}>
            <span className={notification.unread ? "font-bold text-primary" : "font-bold text-[#191c1e]"}>
              {notification.title}
            </span>{" "}
            {notification.body}
          </p>
          <div className="flex items-center gap-1.5 text-[#3e494a]/70">
            <Clock aria-hidden="true" className="size-3.5" />
            <span className="text-[11px] font-medium uppercase tracking-wide">{notification.time}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function NotificationAvatar({ notification }: { notification: NotificationItem }) {
  if (notification.kind === "medical") {
    return (
      <span className="flex size-14 items-center justify-center rounded-full border-2 border-white bg-teal-50 text-primary shadow-sm">
        <Stethoscope aria-hidden="true" className="size-7" />
      </span>
    );
  }

  if (notification.kind === "promo") {
    return (
      <span className="flex size-14 items-center justify-center rounded-full border-2 border-white bg-[#d4e4fc] text-[#617085] shadow-sm">
        <Tag aria-hidden="true" className="size-7" fill="#617085" />
      </span>
    );
  }

  if (notification.kind === "like") {
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
