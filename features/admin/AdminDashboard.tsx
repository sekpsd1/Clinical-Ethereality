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
import type { Route } from "next";
import Link from "next/link";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/design-system/variants";
import type { AdminDashboardData } from "@/features/admin/dashboard/types";

type DashboardTone = "neutral" | "success" | "warning" | "danger";

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const summaryMetrics = [
    {
      label: "รอตรวจชำระ",
      value: String(data.operations.paymentsPendingReview),
      tone: data.operations.paymentsPendingReview > 0 ? "warning" : "success",
      icon: CreditCard,
      href: "/admin/payments"
    },
    {
      label: "ใบสั่งยา",
      value: String(data.operations.prescriptionsPendingVerification),
      tone: data.operations.prescriptionsPendingVerification > 0 ? "warning" : "success",
      icon: FileText,
      href: "/pharmacist/prescriptions"
    },
    {
      label: "รอจัดเตรียม",
      value: String(data.operations.ordersAwaitingPreparation),
      tone: data.operations.ordersAwaitingPreparation > 0 ? "neutral" : "success",
      icon: PackageCheck,
      href: "/admin/orders"
    }
  ] satisfies Array<{
    label: string;
    value: string;
    tone: DashboardTone;
    icon: typeof CreditCard;
    href: string;
  }>;

  const queueItems = [
    {
      title: "ผู้ใช้ใหม่และคำขอสิทธิ์",
      detail: data.unavailable ? "ฐานข้อมูลยังไม่พร้อมสำหรับคิวอนุมัติ" : "บัญชีแพทย์และเภสัชกรที่รอตรวจสอบ",
      count: data.userApprovals.pendingReview,
      badge: data.unavailable ? "ออฟไลน์" : "ตรวจสอบ",
      tone: data.unavailable ? "danger" : "warning",
      icon: UsersRound,
      href: "/admin/users"
    },
    {
      title: "คำปรึกษาที่รอดำเนินการ",
      detail: "คำขอที่รอชำระเงิน ยืนยันตาราง หรือเตรียมเข้าพบแพทย์",
      count: data.operations.pendingConsultations,
      badge: "วันนี้",
      tone: data.operations.pendingConsultations > 0 ? "neutral" : "success",
      icon: CalendarClock,
      href: "/doctor/consultations"
    },
    {
      title: "การชำระเงินรอตรวจสอบ",
      detail: "สลิปพร้อมเพย์ที่ต้องตรวจสอบก่อนดำเนินงานต่อ",
      count: data.operations.paymentsPendingReview,
      badge: "การเงิน",
      tone: data.operations.paymentsPendingReview > 0 ? "warning" : "success",
      icon: CreditCard,
      href: "/admin/payments"
    },
    {
      title: "ใบสั่งยารอตรวจสอบ",
      detail: "คิวเภสัชกรก่อนจัดเตรียมยา",
      count: data.operations.prescriptionsPendingVerification,
      badge: "คลินิก",
      tone: data.operations.prescriptionsPendingVerification > 0 ? "warning" : "success",
      icon: ClipboardCheck,
      href: "/pharmacist/prescriptions"
    },
    {
      title: "คำสั่งซื้อรอจัดเตรียม",
      detail: "คำสั่งซื้อที่ชำระแล้วหรืออยู่ระหว่างจัดเตรียม",
      count: data.operations.ordersAwaitingPreparation,
      badge: "ปฏิบัติการ",
      tone: data.operations.ordersAwaitingPreparation > 0 ? "neutral" : "success",
      icon: PackageCheck,
      href: "/admin/orders"
    },
    {
      title: "เนื้อหาชุมชนที่ต้องกลั่นกรอง",
      detail: "บทความหรือความคิดเห็นที่ถูกซ่อนและต้องตรวจทาน",
      count: data.operations.moderationQueue,
      badge: "ความปลอดภัย",
      tone: data.operations.moderationQueue > 0 ? "danger" : "success",
      icon: ShieldAlert,
      href: "/admin/moderation"
    }
  ] satisfies Array<{
    title: string;
    detail: string;
    count: number;
    badge: string;
    tone: DashboardTone;
    icon: typeof UsersRound;
    href: string;
  }>;

  const riskItems = [
    {
      title: "สต็อกต่ำ",
      detail: data.unavailable ? "รอเชื่อมต่อฐานข้อมูลเพื่ออ่านสต็อก" : `${data.operations.lowStockProducts} รายการต่ำกว่าเกณฑ์`,
      tone: data.unavailable ? "danger" : data.operations.lowStockProducts > 0 ? "warning" : "success",
      icon: AlertTriangle,
      href: "/admin/inventory"
    },
    {
      title: "การเปลี่ยนสิทธิ์",
      detail: data.unavailable
        ? "รอเชื่อมต่อฐานข้อมูลเพื่ออ่านคิวสิทธิ์"
        : `${data.userApprovals.approvedStaff} บัญชีบุคลากรอนุมัติแล้ว, ${data.userApprovals.suspended} บัญชีถูกระงับ`,
      tone: data.unavailable ? "danger" : "neutral",
      icon: UserCheck,
      href: "/admin/users"
    }
  ] satisfies Array<{
    title: string;
    detail: string;
    tone: DashboardTone;
    icon: typeof AlertTriangle;
    href: string;
  }>;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking sm:mx-0 sm:rounded-[8px] sm:px-6 lg:px-8 lg:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-white/75">ภาพรวมปัจจุบัน</p>
            <h2 className="mt-1 font-headline text-2xl font-bold">คิวปฏิบัติการ</h2>
          </div>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>{data.unavailable ? "ฐานข้อมูลออฟไลน์" : "ใช้งานอยู่"}</StatusBadge>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 lg:gap-4">
          {summaryMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Link
                key={metric.label}
                href={metric.href as Route}
                className="rounded-[8px] bg-white/12 p-3 ring-1 ring-white/15 backdrop-blur-card transition hover:bg-white/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:p-5"
              >
                <Icon aria-hidden="true" className="size-4 text-white/80" strokeWidth={2.2} />
                <p className="mt-3 font-headline text-2xl font-bold">{metric.value}</p>
                <p className="mt-1 text-[10px] font-semibold leading-4 text-white/75">{metric.label}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:gap-4">
        {riskItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.title} href={item.href as Route} className="block">
              <GlassSurface className="h-full p-4 transition hover:border-primary/40">
                <div className="flex items-center justify-between gap-3">
                  <Icon aria-hidden="true" className="size-5 text-primary" strokeWidth={2.1} />
                  <StatusBadge tone={item.tone}>{item.tone === "warning" ? "ตรวจสอบ" : item.tone === "danger" ? "รอระบบ" : "บันทึก"}</StatusBadge>
                </div>
                <h3 className="mt-4 text-sm font-bold text-text">{item.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
              </GlassSurface>
            </Link>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">คิวงาน</h2>
          <p className="text-xs font-semibold text-muted">เลือกคิวเพื่อเปิดหน้าปฏิบัติงาน</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          {queueItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href as Route}
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
                  <ArrowUpRight aria-hidden="true" className="size-4 text-primary" strokeWidth={2.1} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">กิจกรรมล่าสุด</h2>
          <StatusBadge>{data.recentActivities.length} รายการ</StatusBadge>
        </div>
        <div className="mt-4 flex flex-col">
          {data.recentActivities.length === 0 ? (
            <p className="py-3 text-sm text-muted">ยังไม่มีบันทึกกิจกรรมจากระบบ</p>
          ) : null}
          {data.recentActivities.map((item, index) => (
            <Link
              key={item.id}
              href={item.href as Route}
              className={cn(
                "flex items-start gap-3 py-3",
                index !== data.recentActivities.length - 1 && "border-b border-border/70"
              )}
            >
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-5 text-text">{item.title}</span>
                <span className="mt-1 block truncate text-xs leading-5 text-muted">{item.detail}</span>
                <span className="mt-1 block text-[11px] font-semibold text-muted">{item.createdAt}</span>
              </span>
              <ArrowUpRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" strokeWidth={2.1} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
