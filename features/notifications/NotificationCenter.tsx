import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationItem } from "@/components/ui/NotificationItem";
import { markCustomerNotificationsReadAction } from "@/features/notifications/actions";
import type { CustomerNotificationsData } from "@/features/notifications/types";

export function NotificationCenter({ data }: { data: CustomerNotificationsData }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#e0f2f1_0%,#f7f9fb_40%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <NotificationHeader unreadCount={data.unreadCount} />

      <main className="mx-auto w-full max-w-mobile px-6 pb-10 pt-[144px]">
        <section className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Latest Updates</p>
            <h1 className="mt-3 text-[32px] font-extrabold leading-tight text-primary">การแจ้งเตือน</h1>
          </div>
          <form action={markCustomerNotificationsReadAction}>
            <button
              type="submit"
              disabled={data.unreadCount === 0}
              className="border-b-2 border-primary/20 pb-1 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:border-transparent disabled:text-[#3e494a]/45"
            >
              อ่านทั้งหมด
            </button>
          </form>
        </section>

        <section className="space-y-6">
          {data.unavailable ? (
            <EmptyNotificationState title="ไม่สามารถโหลดการแจ้งเตือนได้" body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล" />
          ) : null}

          {!data.unavailable && data.notifications.length === 0 ? (
            <EmptyNotificationState title="ยังไม่มีการแจ้งเตือน" body="อัปเดตใหม่จะแสดงที่นี่" />
          ) : null}

          {data.notifications.map((notification) => (
            <NotificationItem key={notification.id} {...notification} />
          ))}
        </section>
      </main>
    </div>
  );
}

function NotificationHeader({ unreadCount }: { unreadCount: number }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 px-6 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-[104px] w-full max-w-mobile items-center justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/profile" aria-label="Back to profile" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-7" strokeWidth={2.4} />
          </Link>
          <h1 className="truncate text-[28px] font-extrabold tracking-wide text-primary">การแจ้งเตือน</h1>
        </div>
        <form action={markCustomerNotificationsReadAction}>
          <button
            type="submit"
            disabled={unreadCount === 0}
            className="shrink-0 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:text-[#3e494a]/45"
          >
            ทำเป็นอ่านแล้ว
          </button>
        </form>
      </div>
    </header>
  );
}

function EmptyNotificationState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-white/50 bg-white/65 p-6 text-center shadow-sm backdrop-blur-[12px]">
      <h2 className="text-sm font-bold text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{body}</p>
    </div>
  );
}
