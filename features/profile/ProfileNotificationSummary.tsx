import Link from "next/link";
import { Bell, ChevronRight, Clock } from "lucide-react";
import type { CustomerNotificationsData } from "@/features/notifications/types";

const recentNotificationLimit = 3;

export function ProfileNotificationSummary({ data }: { data: CustomerNotificationsData }) {
  const recentNotifications = data.notifications.slice(0, recentNotificationLimit);

  return (
    <section aria-labelledby="profile-notifications-heading" className="rounded-[24px] border border-white/50 bg-white/75 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell aria-hidden="true" className="size-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <h2 id="profile-notifications-heading" className="text-base font-extrabold text-primary">การแจ้งเตือนล่าสุด</h2>
            <p className="mt-0.5 text-xs leading-5 text-[#3e494a]">อัปเดตจากบัญชีและคำสั่งซื้อของคุณ</p>
          </div>
        </div>
        {data.unreadCount > 0 ? (
          <span className="shrink-0 rounded-full bg-[#ba1a1a]/10 px-3 py-1 text-xs font-extrabold text-[#ba1a1a]" aria-label={`มีการแจ้งเตือนที่ยังไม่อ่าน ${data.unreadCount} รายการ`}>
            ยังไม่อ่าน {data.unreadCount}
          </span>
        ) : null}
      </div>

      {data.unavailable ? <UnavailableNotificationState /> : null}
      {!data.unavailable && recentNotifications.length === 0 ? <EmptyNotificationState /> : null}
      {!data.unavailable && recentNotifications.length > 0 ? (
        <ul className="mt-4 divide-y divide-[#bdc9ca]/20" aria-label="ตัวอย่างการแจ้งเตือนล่าสุด">
          {recentNotifications.map((notification) => (
            <li key={notification.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span className={notification.unread ? "mt-1.5 size-2.5 shrink-0 rounded-full bg-[#ba1a1a]" : "mt-1.5 size-2.5 shrink-0 rounded-full bg-[#bdc9ca]"} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold leading-5 text-[#191c1e]">{notification.title}</p>
                  {notification.body ? <p className="mt-1 break-words text-xs leading-5 text-[#3e494a]">{notification.body}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#3e494a]/70">
                    <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="size-3.5" />{notification.time}</span>
                    <span>{notification.unread ? "ยังไม่อ่าน" : "อ่านแล้ว"}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <Link href="/notifications" className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-primary/20 px-4 py-2 text-sm font-extrabold text-primary active:scale-[0.99]">
        ดูการแจ้งเตือนทั้งหมด
        <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </Link>
    </section>
  );
}

function EmptyNotificationState() {
  return <p className="mt-4 rounded-[18px] bg-[#f7f9fb] px-4 py-3 text-sm leading-6 text-[#3e494a]">ยังไม่มีการแจ้งเตือนใหม่</p>;
}

function UnavailableNotificationState() {
  return <p role="status" className="mt-4 rounded-[18px] bg-[#f7f9fb] px-4 py-3 text-sm leading-6 text-[#3e494a]">ยังไม่สามารถโหลดการแจ้งเตือนได้ในขณะนี้</p>;
}
