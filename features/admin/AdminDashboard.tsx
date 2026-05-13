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

const summaryMetrics = [
  {
    label: "Pending payments",
    value: "8",
    tone: "warning",
    icon: CreditCard
  },
  {
    label: "Prescriptions",
    value: "12",
    tone: "success",
    icon: FileText
  },
  {
    label: "Orders to prep",
    value: "17",
    tone: "neutral",
    icon: PackageCheck
  }
] as const;

const queueItems = [
  {
    title: "New users and role approvals",
    detail: "Doctor and pharmacist accounts waiting for review",
    count: 5,
    badge: "Review",
    tone: "warning",
    icon: UsersRound
  },
  {
    title: "Pending consultations",
    detail: "Paid requests awaiting schedule confirmation",
    count: 9,
    badge: "Today",
    tone: "neutral",
    icon: CalendarClock
  },
  {
    title: "Payments pending review",
    detail: "PromptPay slips requiring verification",
    count: 8,
    badge: "Money",
    tone: "warning",
    icon: CreditCard
  },
  {
    title: "Prescriptions awaiting verification",
    detail: "Pharmacist queue before medicine preparation",
    count: 12,
    badge: "Clinical",
    tone: "success",
    icon: ClipboardCheck
  },
  {
    title: "Orders awaiting preparation",
    detail: "Verified orders ready for pharmacy workflow",
    count: 17,
    badge: "Ops",
    tone: "neutral",
    icon: PackageCheck
  },
  {
    title: "Reported community content",
    detail: "Posts or comments needing moderation",
    count: 3,
    badge: "Safety",
    tone: "danger",
    icon: ShieldAlert
  }
] as const;

const riskItems = [
  {
    title: "Low stock",
    detail: "4 products below threshold",
    tone: "warning",
    icon: AlertTriangle
  },
  {
    title: "Role changes",
    detail: "2 admin actions need audit notes",
    tone: "neutral",
    icon: UserCheck
  }
] as const;

const activityItems = [
  "Payment slip uploaded for order CE-1042",
  "Dr. Somchai schedule update requested",
  "Pharmacist verification completed for RX-209",
  "Community report opened for vitamin article"
] as const;

export function AdminDashboard() {
  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-white/75">Live overview</p>
            <h2 className="mt-1 font-headline text-2xl font-bold">Operations queue</h2>
          </div>
          <StatusBadge tone="success">Active</StatusBadge>
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
                <StatusBadge tone={item.tone}>{item.tone === "warning" ? "Check" : "Audit"}</StatusBadge>
              </div>
              <h3 className="mt-4 text-sm font-bold text-text">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
            </GlassSurface>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">Work queues</h2>
          <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-bold text-primary">
            View all
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
          <h2 className="font-headline text-lg font-bold text-text">Recent activity</h2>
          <StatusBadge>Audit</StatusBadge>
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
