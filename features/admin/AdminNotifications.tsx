import { Bell, CheckCircle2, UsersRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminNotificationForm } from "@/features/admin/AdminNotificationForm";
import type { AdminNotificationItem, AdminNotificationsData } from "@/features/admin/notifications/types";

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
      label: "Unread",
      value: String(data.summary.unread),
      tone: "warning"
    },
    {
      label: "Recent",
      value: String(data.summary.totalRecent),
      tone: "neutral"
    },
    {
      label: "Recipients",
      value: String(data.summary.recipients),
      tone: "success"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">Notifications</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">Admin message center</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          Send in-app notifications to customers and staff, then review recent delivery records.
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
          <h2 className="font-headline text-lg font-bold text-text">Send notification</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "Database offline" : "Ready"}
          </StatusBadge>
        </div>
        {data.unavailable ? (
          <EmptyNotifications
            title="Database is not connected"
            body="Set DATABASE_URL and run the Prisma schema before sending notifications."
          />
        ) : (
          <AdminNotificationForm recipients={data.recipients} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-headline text-lg font-bold text-text">Recent notifications</h2>

        {!data.unavailable && data.notifications.length === 0 ? (
          <EmptyNotifications title="No notifications yet" body="Messages sent from this page will appear here." />
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
                    <StatusBadge tone={tone}>{notification.type}</StatusBadge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">
                    {notification.body ?? "No message body."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="Recipient" value={notification.userLineId} icon="user" />
                <InfoTile label="Read" value={notification.readAt ?? "Unread"} icon="read" />
              </div>
              <p className="mt-3 truncate border-t border-border/70 pt-3 text-[11px] font-semibold text-muted">
                Created {notification.createdAt} / {notification.channel}
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

function InfoTile({ label, value, icon }: { label: string; value: string; icon: "read" | "user" }) {
  const Icon = icon === "read" ? CheckCircle2 : UsersRound;

  return (
    <div className="rounded-[8px] bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted">
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
        <p className="text-[10px] font-bold uppercase">{label}</p>
      </div>
      <p className="mt-0.5 truncate font-bold text-primary">{value}</p>
    </div>
  );
}
