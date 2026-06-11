import { Bell, CheckCircle2, UsersRound } from "lucide-react";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminNotificationForm } from "@/features/admin/AdminNotificationForm";
import type { AdminNotificationItem, AdminNotificationsData } from "@/features/admin/notifications/types";

const notificationTypeLabels: Record<AdminNotificationItem["type"], string> = {
  community: "ชุมชน",
  consultation: "ปรึกษา",
  order: "คำสั่งซื้อ",
  payment: "ชำระเงิน",
  prescription: "ใบสั่งยา",
  reward: "แต้มสะสม",
  system: "ระบบ"
};

const notificationChannelLabels: Record<AdminNotificationItem["channel"], string> = {
  email: "อีเมล",
  in_app: "ในแอป",
  line: "LINE"
};

function getTypeTone(type: AdminNotificationItem["type"]): "neutral" | "success" | "warning" | "danger" {
  if (type === "payment" || type === "prescription") {
    return "warning";
  }

  if (type === "reward") {
    return "success";
  }

  if (type === "system") {
    return "neutral";
  }

  return "neutral";
}

export function AdminNotifications({ data }: { data: AdminNotificationsData }) {
  const summaryItems = [
    {
      label: "ยังไม่อ่าน",
      value: String(data.summary.unread),
      tone: "warning"
    },
    {
      label: "ล่าสุด",
      value: String(data.summary.totalRecent),
      tone: "neutral"
    },
    {
      label: "ผู้รับ",
      value: String(data.summary.recipients),
      tone: "success"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">การแจ้งเตือน</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">ศูนย์ข้อความผู้ดูแล</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ส่งข้อความในแอปให้ลูกค้าและทีมงาน พร้อมตรวจประวัติการส่งล่าสุด
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
            <p className="font-headline text-2xl font-bold text-text">{item.value}</p>
            <p className="mt-1 min-h-8 text-[10px] font-semibold leading-4 text-muted">{item.label}</p>
            <div className="mt-2">
              <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">ส่งการแจ้งเตือน</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "ฐานข้อมูลไม่พร้อม" : "พร้อมใช้งาน"}
          </StatusBadge>
        </div>
        {data.unavailable ? (
          <EmptyNotifications
            title="ยังเชื่อมต่อฐานข้อมูลไม่ได้"
            body="ตั้งค่าฐานข้อมูลและเตรียมโครงสร้างข้อมูลก่อนส่งการแจ้งเตือน"
          />
        ) : (
          <AdminNotificationForm recipients={data.recipients} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-headline text-lg font-bold text-text">การแจ้งเตือนล่าสุด</h2>

        {!data.unavailable && data.notifications.length === 0 ? (
          <EmptyNotifications title="ยังไม่มีการแจ้งเตือน" body="ข้อความที่ส่งจากหน้านี้จะแสดงที่นี่" />
        ) : null}

        {data.notifications.map((notification) => {
          const tone = getTypeTone(notification.type);

          return (
            <article key={notification.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Bell aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{notification.title}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{notification.userName}</p>
                    </div>
                    <StatusBadge tone={tone}>{notificationTypeLabels[notification.type]}</StatusBadge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">
                    {notification.body ?? "ไม่มีเนื้อหาข้อความ"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="ผู้รับ" value={notification.userLineId} icon={<UsersRound aria-hidden="true" className="size-3.5" strokeWidth={2.1} />} />
                <InfoTile label="อ่านเมื่อ" value={notification.readAt ?? "ยังไม่อ่าน"} icon={<CheckCircle2 aria-hidden="true" className="size-3.5" strokeWidth={2.1} />} />
              </div>
              <p className="mt-3 truncate border-t border-border/70 pt-3 text-[11px] font-semibold text-muted">
                สร้างเมื่อ {notification.createdAt} / {notificationChannelLabels[notification.channel]}
              </p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyNotifications({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}
