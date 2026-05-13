import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileText,
  PackageCheck,
  ShieldAlert,
  UserCheck,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/design-system/variants";
import type { AdminDashboardData } from "@/features/admin/dashboard/types";

type DashboardTone = "neutral" | "success" | "warning" | "danger";

const activityItems = [
  "อัปโหลดสลิปชำระเงินสำหรับคำสั่งซื้อ CE-1042",
  "มีคำขออัปเดตตารางของ นพ.สมชาย",
  "เภสัชกรตรวจสอบ RX-209 เสร็จแล้ว",
  "เปิดรายงานชุมชนสำหรับบทความวิตามิน"
] as const;

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const summaryMetrics = [
    {
      label: "รอตรวจชำระ",
      value: String(data.operations.paymentsPendingReview),
      tone: data.operations.paymentsPendingReview > 0 ? "warning" : "success",
      icon: CreditCard
    },
    {
      label: "ใบสั่งยา",
      value: String(data.operations.prescriptionsPendingVerification),
      tone: data.operations.prescriptionsPendingVerification > 0 ? "warning" : "success",
      icon: FileText
    },
    {
      label: "รอจัดเตรียม",
      value: String(data.operations.ordersAwaitingPreparation),
      tone: data.operations.ordersAwaitingPreparation > 0 ? "neutral" : "success",
      icon: PackageCheck
    }
  ] satisfies Array<{
    label: string;
    value: string;
    tone: DashboardTone;
    icon: typeof CreditCard;
  }>;

  const queueItems = [
    {
      title: "ผู้ใช้ใหม่และคำขอสิทธิ์",
      detail: data.unavailable ? "ฐานข้อมูลยังไม่พร้อมสำหรับคิวอนุมัติ" : "บัญชีแพทย์และเภสัชกรที่รอตรวจสอบ",
      count: data.userApprovals.pendingReview,
      badge: data.unavailable ? "ออฟไลน์" : "ตรวจสอบ",
      tone: data.unavailable ? "danger" : "warning",
      icon: UsersRound
    },
    {
      title: "คำปรึกษาที่รอดำเนินการ",
      detail: "คำขอที่รอชำระเงิน ยืนยันตาราง หรือเตรียมเข้าพบแพทย์",
      count: data.operations.pendingConsultations,
      badge: "วันนี้",
      tone: data.operations.pendingConsultations > 0 ? "neutral" : "success",
      icon: CalendarClock
    },
    {
      title: "การชำระเงินรอตรวจสอบ",
      detail: "สลิปพร้อมเพย์ที่ต้องตรวจสอบก่อนดำเนินงานต่อ",
      count: data.operations.paymentsPendingReview,
      badge: "การเงิน",
      tone: data.operations.paymentsPendingReview > 0 ? "warning" : "success",
      icon: CreditCard
    },
    {
      title: "ใบสั่งยารอตรวจสอบ",
      detail: "คิวเภสัชกรก่อนจัดเตรียมยา",
      count: data.operations.prescriptionsPendingVerification,
      badge: "คลินิก",
      tone: data.operations.prescriptionsPendingVerification > 0 ? "warning" : "success",
      icon: ClipboardCheck
    },
    {
      title: "คำสั่งซื้อรอจัดเตรียม",
      detail: "คำสั่งซื้อที่ชำระแล้วหรืออยู่ระหว่างจัดเตรียม",
      count: data.operations.ordersAwaitingPreparation,
      badge: "ปฏิบัติการ",
      tone: data.operations.ordersAwaitingPreparation > 0 ? "neutral" : "success",
      icon: PackageCheck
    },
    {
      title: "เนื้อหาชุมชนที่ต้องกลั่นกรอง",
      detail: "บทความหรือความคิดเห็นที่ถูกซ่อนและต้องตรวจทาน",
      count: data.operations.moderationQueue,
      badge: "ความปลอดภัย",
      tone: data.operations.moderationQueue > 0 ? "danger" : "success",
      icon: ShieldAlert
    }
  ] satisfies Array<{
    title: string;
    detail: string;
    count: number;
    badge: string;
    tone: DashboardTone;
    icon: typeof UsersRound;
  }>;

  const riskItems = [
    {
      title: "สต็อกต่ำ",
      detail: data.unavailable ? "รอเชื่อมต่อฐานข้อมูลเพื่ออ่านสต็อก" : `${data.operations.lowStockProducts} รายการต่ำกว่าเกณฑ์`,
      tone: data.unavailable ? "danger" : data.operations.lowStockProducts > 0 ? "warning" : "success",
      icon: AlertTriangle
    },
    {
      title: "การเปลี่ยนสิทธิ์",
      detail: data.unavailable
        ? "รอเชื่อมต่อฐานข้อมูลเพื่ออ่านคิวสิทธิ์"
        : `${data.userApprovals.approvedStaff} บัญชีบุคลากรอนุมัติแล้ว, ${data.userApprovals.suspended} บัญชีถูกระงับ`,
      tone: data.unavailable ? "danger" : "neutral",
      icon: UserCheck
    }
  ] satisfies Array<{
    title: string;
    detail: string;
    tone: DashboardTone;
    icon: typeof AlertTriangle;
  }>;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-white/75">ภาพรวมปัจจุบัน</p>
            <h2 className="mt-1 font-headline text-2xl font-bold">คิวปฏิบัติการ</h2>
          </div>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>{data.unavailable ? "ฐานข้อมูลออฟไลน์" : "ใช้งานอยู่"}</StatusBadge>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {summaryMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div key={metric.label} className="rounded-[8px] bg-white/12 p-3 ring-1 ring-white/15 backdrop-blur-card">
                <Icon aria-hidden="true" className="size-4 text-white/80" strokeWidth={2.2} />
                <p className="mt-3 font-headline text-2xl font-bold">{metric.value}</p>
                <p className="mt-1 text-[10px] font-semibold leading-4 text-white/75">{metric.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {riskItems.map((item) => {
          const Icon = item.icon;

          return (
            <GlassSurface key={item.title} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <Icon aria-hidden="true" className="size-5 text-primary" strokeWidth={2.1} />
                <StatusBadge tone={item.tone}>{item.tone === "warning" ? "ตรวจสอบ" : item.tone === "danger" ? "รอระบบ" : "บันทึก"}</StatusBadge>
              </div>
              <h3 className="mt-4 text-sm font-bold text-text">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
            </GlassSurface>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">คิวงาน</h2>
          <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-bold text-primary">
            ดูทั้งหมด
            <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2.1} />
          </Link>
        </div>

        {queueItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="flex items-center gap-3 rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-text">{item.title}</h3>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.detail}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="font-headline text-xl font-bold text-text">{item.count}</span>
                <StatusBadge tone={item.tone}>{item.badge}</StatusBadge>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">กิจกรรมล่าสุด</h2>
          <StatusBadge>ตรวจทาน</StatusBadge>
        </div>
        <div className="mt-4 flex flex-col">
          {activityItems.map((item, index) => (
            <div
              key={item}
              className={cn("flex gap-3 py-3", index !== activityItems.length - 1 && "border-b border-border/70")}
            >
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              <p className="text-sm leading-5 text-muted">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
