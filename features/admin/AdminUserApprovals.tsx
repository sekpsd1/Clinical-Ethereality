import { CheckCircle2, Clock3, ShieldAlert, Stethoscope, UserRound, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/design-system/variants";
import { approveStaffRoleAction, updateUserStatusAction } from "@/features/admin/users/actions";
import type { AdminUserApprovalItem, AdminUserApprovalsData } from "@/features/admin/users/types";

const auditItems = [
  "Role changes require admin session and audit note.",
  "Doctor and pharmacist approval should wait for license data.",
  "Suspension should be non-destructive and preserve historical records."
] as const;

const roleIcons = {
  admin: ShieldAlert,
  customer: UserRound,
  doctor: Stethoscope,
  pharmacist: ShieldAlert
} as const;

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getStatusTone(user: AdminUserApprovalItem): "neutral" | "success" | "warning" | "danger" {
  if (user.status === "suspended" || user.status === "archived" || user.staffStatus === "rejected" || user.staffStatus === "suspended") {
    return "danger";
  }

  if (user.status === "pending_review" || user.staffStatus === "pending_review") {
    return "warning";
  }

  if (user.staffStatus === "approved" || user.status === "active") {
    return "success";
  }

  return "neutral";
}

function formatStatus(user: AdminUserApprovalItem): string {
  return (user.staffStatus ?? user.status)
    .split("_")
    .map((part) => formatRole(part))
    .join(" ");
}

export function AdminUserApprovals({ data }: { data: AdminUserApprovalsData }) {
  const approvalSummary = [
    {
      label: "Pending review",
      value: String(data.summary.pendingReview),
      tone: "warning"
    },
    {
      label: "Approved staff",
      value: String(data.summary.approvedStaff),
      tone: "success"
    },
    {
      label: "Suspended",
      value: String(data.summary.suspended),
      tone: "danger"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">Access control</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">Users and role approvals</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          Review LINE-linked users before granting doctor, pharmacist, or admin privileges.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {approvalSummary.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
            <p className="font-headline text-2xl font-bold text-text">{item.value}</p>
            <p className="mt-1 min-h-8 text-[10px] font-semibold leading-4 text-muted">{item.label}</p>
            <div className="mt-2">
              <StatusBadge tone={item.tone}>{item.tone === "warning" ? "Queue" : item.tone === "success" ? "OK" : "Hold"}</StatusBadge>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">Approval queue</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>{data.unavailable ? "DB offline" : "Live"}</StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyQueue
            title="Database is not connected"
            body="Set DATABASE_URL and run the Prisma schema before using live admin approval queues."
          />
        ) : data.users.length === 0 ? (
          <EmptyQueue title="No users to review" body="LINE-linked users and staff role requests will appear here." />
        ) : null}

        {data.users.map((user) => {
          const Icon = roleIcons[user.requestedRole];
          const tone = getStatusTone(user);

          return (
            <article key={user.lineId} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{user.name}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{user.lineId}</p>
                    </div>
                    <StatusBadge tone={tone}>{formatStatus(user)}</StatusBadge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">{user.profile}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="Current" value={formatRole(user.currentRole)} />
                <InfoTile label="Requested" value={formatRole(user.requestedRole)} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted">
                  <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{user.submittedAt}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={updateUserStatusAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="status" value="suspended" />
                    <button
                      type="submit"
                      className="inline-flex size-9 items-center justify-center rounded-full border border-danger/20 bg-danger/10 text-danger"
                      aria-label={`Suspend ${user.name}`}
                    >
                      <XCircle aria-hidden="true" className="size-4" strokeWidth={2.1} />
                    </button>
                  </form>
                  {user.requestedRole !== "customer" ? (
                    <form action={approveStaffRoleAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="role" value={user.requestedRole} />
                      <button
                        type="submit"
                        className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-white"
                        aria-label={`Approve ${user.name}`}
                      >
                        <CheckCircle2 aria-hidden="true" className="size-4" strokeWidth={2.1} />
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
        <h2 className="font-headline text-lg font-bold text-text">Approval safeguards</h2>
        <div className="mt-3 flex flex-col">
          {auditItems.map((item, index) => (
            <div key={item} className={cn("flex gap-3 py-3", index !== auditItems.length - 1 && "border-b border-border/70")}>
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              <p className="text-sm leading-5 text-muted">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyQueue({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-primary/5 px-3 py-2">
      <p className="text-[10px] font-bold uppercase text-muted">{label}</p>
      <p className="mt-0.5 truncate font-bold text-primary">{value}</p>
    </div>
  );
}
