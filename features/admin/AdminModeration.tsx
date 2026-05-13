import { FileText, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminModerationActionButtons } from "@/features/admin/AdminModerationActionButtons";
import type { AdminModerationData, AdminModerationQueueItem } from "@/features/admin/moderation/types";

const itemTypeLabels = {
  article: "Article",
  comment: "Comment"
};

const statusLabels: Record<string, string> = {
  archived: "Archived",
  draft: "Draft",
  hidden: "Hidden",
  published: "Published",
  visible: "Visible"
};

function getStatusTone(status: AdminModerationQueueItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "published" || status === "visible") {
    return "success";
  }

  if (status === "hidden") {
    return "warning";
  }

  if (status === "archived") {
    return "danger";
  }

  return "neutral";
}

export function AdminModeration({ data }: { data: AdminModerationData }) {
  const summaryItems = [
    {
      label: "Articles",
      value: String(data.summary.hiddenArticles),
      tone: "warning"
    },
    {
      label: "Comments",
      value: String(data.summary.hiddenComments),
      tone: "warning"
    },
    {
      label: "Archived",
      value: String(data.summary.archived),
      tone: "danger"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">Community Safety</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">Moderation queue</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          Review hidden community articles and comments, then restore or archive content with one action.
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
          <h2 className="font-headline text-lg font-bold text-text">Content</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "Database offline" : "Ready"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyModerationQueue
            title="Database is not connected"
            body="Set DATABASE_URL and run the Prisma schema before managing community moderation."
          />
        ) : data.items.length === 0 ? (
          <EmptyModerationQueue title="No content in review" body="Hidden or archived articles and comments will appear here." />
        ) : null}

        {data.items.map((item) => {
          const Icon = item.type === "article" ? FileText : MessageSquareWarning;
          const tone = getStatusTone(item.status);

          return (
            <article key={`${item.type}-${item.id}`} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{item.title}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">
                        {itemTypeLabels[item.type]} / {item.authorName}
                      </p>
                    </div>
                    <StatusBadge tone={tone}>{statusLabels[item.status]}</StatusBadge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted">{item.body}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                    <ShieldAlert aria-hidden="true" className="size-4 text-primary" strokeWidth={2.1} />
                    <span className="truncate">{item.authorLineId}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] font-semibold text-muted">Created {item.createdAt}</p>
                </div>
                <AdminModerationActionButtons item={item} />
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyModerationQueue({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}
