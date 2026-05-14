import { Clock3, ShieldAlert, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/design-system/variants";
import { AdminUserActionButtons } from "@/features/admin/AdminUserActionButtons";
import type { AdminUserApprovalItem, AdminUserApprovalsData } from "@/features/admin/users/types";

const auditItems = [
  "การเปลี่ยนสิทธิ์ต้องมีเซสชันผู้ดูแลและบันทึกตรวจสอบ",
  "การอนุมัติแพทย์และเภสัชกรควรรอข้อมูลใบอนุญาต",
  "การระงับบัญชีควรไม่ลบข้อมูลและต้องเก็บประวัติไว้"
] as const;

const roleIcons = {
  admin: ShieldAlert,
  customer: UserRound,
  doctor: Stethoscope,
  pharmacist: ShieldAlert
} as const;

const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  customer: "ลูกค้า",
  doctor: "แพทย์",
  pharmacist: "เภสัชกร"
};

const inviteLinks = [
  {
    label: "เชิญแพทย์",
    href: "/staff-invite/doctor",
    detail: "ให้แพทย์เปิดลิงก์นี้ผ่าน LINE แล้วส่งเลขใบประกอบวิชาชีพ"
  },
  {
    label: "เชิญเภสัชกร",
    href: "/staff-invite/pharmacist",
    detail: "ให้เภสัชกรเปิดลิงก์นี้ผ่าน LINE แล้วส่งข้อมูลใบอนุญาต"
  },
  {
    label: "เชิญผู้ดูแลระบบ",
    href: "/staff-invite/admin",
    detail: "ใช้สำหรับทีมปฏิบัติการที่ต้องให้ผู้ดูแลระบบเดิมอนุมัติ"
  }
] as const;

const statusLabels: Record<string, string> = {
  active: "ใช้งานอยู่",
  approved: "อนุมัติแล้ว",
  archived: "เก็บถาวร",
  pending_review: "รอตรวจสอบ",
  rejected: "ปฏิเสธแล้ว",
  suspended: "ระงับใช้งาน"
};

function formatRole(role: string): string {
  return roleLabels[role] ?? role;
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
  const status = user.staffStatus ?? user.status;

  return statusLabels[status] ?? status;
}

export function AdminUserApprovals({ data }: { data: AdminUserApprovalsData }) {
  const approvalSummary = [
    {
      label: "รอตรวจสอบ",
      value: String(data.summary.pendingReview),
      tone: "warning"
    },
    {
      label: "บุคลากรอนุมัติแล้ว",
      value: String(data.summary.approvedStaff),
      tone: "success"
    },
    {
      label: "ระงับใช้งาน",
      value: String(data.summary.suspended),
      tone: "danger"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">ควบคุมการเข้าถึง</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">ผู้ใช้และการอนุมัติสิทธิ์</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ตรวจสอบผู้ใช้ที่เชื่อมต่อ LINE ก่อนให้สิทธิ์แพทย์ เภสัชกร หรือผู้ดูแลระบบ
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {approvalSummary.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
            <p className="font-headline text-2xl font-bold text-text">{item.value}</p>
            <p className="mt-1 min-h-8 text-[10px] font-semibold leading-4 text-muted">{item.label}</p>
            <div className="mt-2">
              <StatusBadge tone={item.tone}>{item.tone === "warning" ? "คิว" : item.tone === "success" ? "ผ่าน" : "พักไว้"}</StatusBadge>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-label font-bold uppercase text-primary">ลิงก์เชิญบุคลากร</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-text">ส่งให้บุคลากรเพื่อขอสิทธิ์</h2>
          </div>
          <StatusBadge>LINE</StatusBadge>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {inviteLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[8px] border border-border/80 bg-primary/5 px-3 py-3 text-sm font-bold text-primary"
            >
              <span className="block">{item.label}</span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-muted">{item.detail}</span>
              <span className="mt-2 block truncate text-[11px] font-semibold text-primary/70">{item.href}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">คิวอนุมัติ</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>{data.unavailable ? "ฐานข้อมูลออฟไลน์" : "พร้อมใช้งาน"}</StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyQueue
            title="ยังไม่ได้เชื่อมต่อฐานข้อมูล"
            body="ตั้งค่า DATABASE_URL และรัน Prisma schema ก่อนใช้คิวอนุมัติจริงของผู้ดูแล"
          />
        ) : data.users.length === 0 ? (
          <EmptyQueue title="ไม่มีผู้ใช้ที่ต้องตรวจสอบ" body="ผู้ใช้ที่เชื่อมต่อ LINE และคำขอสิทธิ์บุคลากรจะแสดงที่นี่" />
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
                <InfoTile label="ปัจจุบัน" value={formatRole(user.currentRole)} />
                <InfoTile label="สิทธิ์ที่ขอ" value={formatRole(user.requestedRole)} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted">
                  <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{user.submittedAt}</span>
                </div>
                <AdminUserActionButtons user={user} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
        <h2 className="font-headline text-lg font-bold text-text">มาตรการคุมการอนุมัติ</h2>
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
