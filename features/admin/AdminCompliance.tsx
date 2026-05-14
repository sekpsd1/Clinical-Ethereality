import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  DatabaseBackup,
  FileCheck2,
  HeartPulse,
  KeyRound,
  Landmark,
  PackageCheck,
  Pill,
  ShieldCheck,
  Truck
} from "lucide-react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { StatusBadge } from "@/components/ui/StatusBadge";

const readinessSummary = [
  {
    label: "App safeguards",
    value: "Ready",
    tone: "success",
    detail: "Role boundaries, audit trail, backups, and monitoring wiring are in place."
  },
  {
    label: "Client documents",
    value: "Blocked",
    tone: "warning",
    detail: "PDPA, terms, consent wording, SOPs, and company/payment details still need client approval."
  },
  {
    label: "Production launch",
    value: "Hold",
    tone: "danger",
    detail: "Do not launch with patient-like records until legal, vendor, and operational approvals are complete."
  }
] as const;

const complianceSections = [
  {
    title: "Legal and PDPA",
    icon: FileCheck2,
    status: "Need client",
    tone: "warning",
    items: [
      "Thai PDPA privacy policy approved for health-related records.",
      "Thai terms of service approved for consultation, commerce, pharmacy, and community use.",
      "Cookie or tracking notice approved if analytics, pixels, or monitoring beyond essential error capture are used.",
      "Refund, cancellation, shipping, delivery, and community moderation policies approved."
    ]
  },
  {
    title: "Health data consent",
    icon: HeartPulse,
    status: "Need client",
    tone: "warning",
    items: [
      "Explicit consent wording for collecting health-related consultation information.",
      "Teleconsultation consent, including video/chat limitations and no-show handling.",
      "Prescription and pharmacy fulfillment consent.",
      "Medical disclaimer for community posts and article content."
    ]
  },
  {
    title: "Access and privacy controls",
    icon: KeyRound,
    status: "App ready",
    tone: "success",
    items: [
      "Customer, doctor, pharmacist, and admin routes are role protected.",
      "Sensitive actions are guarded by server-side permission checks.",
      "LINE LIFF plus JWT remains the MVP customer identity path.",
      "Production must keep local dev auth bypass disabled."
    ]
  },
  {
    title: "Audit, backup, and monitoring",
    icon: DatabaseBackup,
    status: "Configured",
    tone: "success",
    items: [
      "Sensitive state changes write audit records where workflows are implemented.",
      "Backup and restore readiness is documented before patient-like records are entered.",
      "Sentry error monitoring is wired with default PII capture disabled.",
      "Production must verify a non-sensitive test event reaches monitoring."
    ]
  },
  {
    title: "Clinical and pharmacy operations",
    icon: Pill,
    status: "Need SOP",
    tone: "warning",
    items: [
      "Doctor license details, profile content, pricing, and availability must be approved.",
      "Pharmacy license and pharmacist license details must be approved.",
      "Prescription verification, medicine preparation, packing, and shipment SOPs must be supplied.",
      "Controlled item restrictions must be documented before product activation."
    ]
  },
  {
    title: "Payments and fulfillment",
    icon: Landmark,
    status: "Need credentials",
    tone: "warning",
    items: [
      "PromptPay owner, bank account name, bank, and secure storage location must be confirmed.",
      "SlipOK or EasySlip provider choice and API credentials must be supplied securely.",
      "Payment success, rejection, refund, and manual review rules must be approved.",
      "Shipping provider, delivery fees, free-shipping rules, and tracking format must be confirmed."
    ]
  }
] as const;

const launchGateLinks = [
  {
    label: "Audit log",
    href: "/admin/audit",
    icon: ShieldCheck
  },
  {
    label: "User approvals",
    href: "/admin/users",
    icon: BadgeCheck
  },
  {
    label: "Payment review",
    href: "/admin/payments",
    icon: Landmark
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: PackageCheck
  },
  {
    label: "Inventory",
    href: "/admin/inventory",
    icon: Truck
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: BellRing
  }
] as const;

export function AdminCompliance() {
  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-white/75">Production readiness</p>
            <h2 className="mt-1 font-headline text-2xl font-bold">Compliance review</h2>
            <p className="mt-2 text-sm leading-6 text-white/80">
              Review these gates before enabling real consultation, prescription, payment, or pharmacy records.
            </p>
          </div>
          <StatusBadge tone="danger">Launch hold</StatusBadge>
        </div>
      </section>

      <section className="grid gap-3">
        {readinessSummary.map((item) => (
          <GlassSurface key={item.label} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-label font-bold uppercase text-primary">{item.label}</p>
                <h3 className="mt-1 font-headline text-xl font-bold text-text">{item.value}</h3>
              </div>
              <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{item.detail}</p>
          </GlassSurface>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <p className="text-label font-bold uppercase text-primary">Review checklist</p>
          <h2 className="mt-1 font-headline text-lg font-bold text-text">Required before production launch</h2>
        </div>

        {complianceSections.map((section) => {
          const Icon = section.icon;

          return (
            <article key={section.title} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={2.1} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-text">{section.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted">{section.status}</p>
                  </div>
                </div>
                <StatusBadge tone={section.tone}>{section.status}</StatusBadge>
              </div>
              <ul className="mt-4 flex flex-col gap-2">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-muted">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-label font-bold uppercase text-primary">Admin checks</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-text">Operational surfaces to verify</h2>
          </div>
          <StatusBadge>Before launch</StatusBadge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {launchGateLinks.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[86px] flex-col justify-between rounded-[8px] border border-border/80 bg-surface p-3 text-text"
              >
                <Icon aria-hidden="true" className="size-5 text-primary" strokeWidth={2.1} />
                <span className="flex items-center justify-between gap-2 text-xs font-bold">
                  {item.label}
                  <ArrowUpRight aria-hidden="true" className="size-4 text-primary" strokeWidth={2.1} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
