import { Bell } from "lucide-react";
import { NotificationItem } from "@/components/ui/NotificationItem";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { markDoctorNotificationsReadAction } from "@/features/doctor/notifications/actions";
import type { DoctorNotificationsData } from "@/features/doctor/notifications/types";

export function DoctorNotifications({ data }: { data: DoctorNotificationsData }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">งานแพทย์</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">การแจ้งเตือน</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ติดตามข้อความใหม่ การเปลี่ยนสถานะนัด และข้อมูลที่ต้องดำเนินการ
        </p>
      </section>

      <section className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell aria-hidden="true" className="size-5 text-primary" strokeWidth={2.1} />
          <h2 className="font-headline text-lg font-bold text-text">รายการล่าสุด</h2>
          <StatusBadge tone={data.unreadCount > 0 ? "warning" : "neutral"}>{data.unreadCount} ยังไม่อ่าน</StatusBadge>
        </div>
        <form action={markDoctorNotificationsReadAction}>
          <button
            type="submit"
            disabled={data.unreadCount === 0}
            className="text-xs font-bold text-primary disabled:text-muted"
          >
            อ่านทั้งหมด
          </button>
        </form>
      </section>

      {data.unavailable ? (
        <EmptyNotificationState title="ยังโหลดการแจ้งเตือนไม่ได้" body="กรุณาตรวจการเชื่อมต่อฐานข้อมูล" />
      ) : data.notifications.length === 0 ? (
        <EmptyNotificationState title="ยังไม่มีการแจ้งเตือน" body="ข้อความและสถานะใหม่จะแสดงที่นี่" />
      ) : (
        <section className="space-y-3">
          {data.notifications.map((notification) => (
            <NotificationItem key={notification.id} {...notification} />
          ))}
        </section>
      )}
    </div>
  );
}

function EmptyNotificationState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}
