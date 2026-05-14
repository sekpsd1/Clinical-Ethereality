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
    label: "ระบบป้องกันในแอป",
    value: "พร้อม",
    tone: "success",
    detail: "มีการแยกสิทธิ์ตามบทบาท บันทึก audit trail แผนสำรองข้อมูล และระบบติดตาม error แล้ว"
  },
  {
    label: "เอกสารจากลูกค้า",
    value: "รอลูกค้า",
    tone: "warning",
    detail: "ยังต้องได้รับ PDPA, Terms, ข้อความยินยอม, SOP และข้อมูลบริษัท/การชำระเงินที่อนุมัติแล้ว"
  },
  {
    label: "การเปิดใช้งานจริง",
    value: "พักไว้ก่อน",
    tone: "danger",
    detail: "ห้ามเปิดใช้งานกับข้อมูลผู้ป่วยจริงหรือข้อมูลคล้ายผู้ป่วยจนกฎหมาย vendor และขั้นตอนปฏิบัติได้รับอนุมัติครบ"
  }
] as const;

const complianceSections = [
  {
    title: "กฎหมายและ PDPA",
    icon: FileCheck2,
    status: "รอลูกค้า",
    tone: "warning",
    items: [
      "Privacy Policy ภาษาไทยตาม PDPA ที่ครอบคลุมข้อมูลสุขภาพ",
      "Terms of Service ภาษาไทยสำหรับ consultation, commerce, pharmacy และ community",
      "Cookie หรือ tracking notice หากมี analytics, marketing pixel หรือ monitoring เกินกว่าการจับ error ที่จำเป็น",
      "นโยบายคืนเงิน ยกเลิก จัดส่ง ส่งมอบ และ moderation ของ community"
    ]
  },
  {
    title: "ความยินยอมด้านข้อมูลสุขภาพ",
    icon: HeartPulse,
    status: "รอลูกค้า",
    tone: "warning",
    items: [
      "ข้อความยินยอมสำหรับการเก็บข้อมูลสุขภาพและข้อมูลประกอบการปรึกษา",
      "ข้อความยินยอมสำหรับ teleconsultation รวมข้อจำกัดของวิดีโอ/แชทและ no-show",
      "ข้อความยินยอมสำหรับใบสั่งยาและการจัดเตรียม/จัดส่งยาโดยร้านยา",
      "Medical disclaimer สำหรับโพสต์ community และบทความสุขภาพ"
    ]
  },
  {
    title: "สิทธิ์เข้าถึงและความเป็นส่วนตัว",
    icon: KeyRound,
    status: "ระบบพร้อม",
    tone: "success",
    items: [
      "เส้นทางของลูกค้า หมอ เภสัชกร และแอดมินถูกแยกสิทธิ์ตามบทบาท",
      "การกระทำที่เกี่ยวกับข้อมูลสำคัญตรวจสิทธิ์ฝั่ง server",
      "MVP ใช้ LINE LIFF และ JWT เป็นเส้นทางยืนยันตัวตนหลักของลูกค้า",
      "Production ต้องปิด local dev auth bypass เสมอ"
    ]
  },
  {
    title: "Audit, backup และ monitoring",
    icon: DatabaseBackup,
    status: "ตั้งค่าแล้ว",
    tone: "success",
    items: [
      "workflow ที่เปลี่ยนสถานะสำคัญมีการบันทึก audit record แล้วในส่วนที่ implement",
      "มีเอกสาร backup และ restore readiness ก่อนนำข้อมูลคล้ายผู้ป่วยเข้าใช้งาน",
      "เชื่อม Sentry error monitoring แล้ว โดยปิด default PII capture",
      "Production ต้องทดสอบส่ง event ที่ไม่ใช่ข้อมูลอ่อนไหวเข้า monitoring ก่อนเปิดใช้จริง"
    ]
  },
  {
    title: "งานคลินิกและร้านยา",
    icon: Pill,
    status: "รอ SOP",
    tone: "warning",
    items: [
      "ข้อมูลใบประกอบวิชาชีพหมอ โปรไฟล์ ราคา และตารางเวลาต้องได้รับอนุมัติ",
      "ข้อมูลใบอนุญาตร้านยาและใบประกอบวิชาชีพเภสัชกรต้องได้รับอนุมัติ",
      "ต้องมี SOP สำหรับตรวจใบสั่งยา เตรียมยา แพ็กยา และจัดส่ง",
      "ข้อจำกัดของสินค้าควบคุมต้องถูกบันทึกก่อนเปิดขายสินค้า"
    ]
  },
  {
    title: "การชำระเงินและจัดส่ง",
    icon: Landmark,
    status: "รอข้อมูล",
    tone: "warning",
    items: [
      "ต้องยืนยันเจ้าของ PromptPay ชื่อบัญชี ธนาคาร และที่เก็บข้อมูลบัญชีอย่างปลอดภัย",
      "ต้องเลือก SlipOK หรือ EasySlip และส่ง API credentials ผ่านช่องทางปลอดภัย",
      "ต้องอนุมัติกฎจ่ายสำเร็จ ปฏิเสธสลิป คืนเงิน และ manual review",
      "ต้องยืนยันขนส่ง ค่าส่ง เงื่อนไขส่งฟรี และรูปแบบเลข tracking"
    ]
  }
] as const;

const launchGateLinks = [
  {
    label: "บันทึก Audit",
    href: "/admin/audit",
    icon: ShieldCheck
  },
  {
    label: "อนุมัติผู้ใช้",
    href: "/admin/users",
    icon: BadgeCheck
  },
  {
    label: "ตรวจชำระเงิน",
    href: "/admin/payments",
    icon: Landmark
  },
  {
    label: "คำสั่งซื้อ",
    href: "/admin/orders",
    icon: PackageCheck
  },
  {
    label: "สต็อก",
    href: "/admin/inventory",
    icon: Truck
  },
  {
    label: "แจ้งเตือน",
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
            <p className="text-label font-bold uppercase text-white/75">ความพร้อมก่อนเปิดใช้งานจริง</p>
            <h2 className="mt-1 font-headline text-2xl font-bold">ตรวจความพร้อมด้าน Compliance</h2>
            <p className="mt-2 text-sm leading-6 text-white/80">
              ตรวจรายการนี้ก่อนเปิดใช้งานข้อมูลการปรึกษา ใบสั่งยา การชำระเงิน หรือการจัดส่งยาจริง
            </p>
          </div>
          <StatusBadge tone="danger">ยังไม่ควรเปิดจริง</StatusBadge>
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
          <p className="text-label font-bold uppercase text-primary">รายการตรวจสอบ</p>
          <h2 className="mt-1 font-headline text-lg font-bold text-text">สิ่งที่ต้องครบก่อนเปิด Production</h2>
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
            <p className="text-label font-bold uppercase text-primary">งานที่แอดมินต้องตรวจ</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-text">หน้าปฏิบัติการที่ควรตรวจซ้ำ</h2>
          </div>
          <StatusBadge>ก่อนเปิดจริง</StatusBadge>
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
