import Link from "next/link";
import { ArrowLeft, Bell, ChevronRight, Languages, LockKeyhole, Settings, ShieldCheck, UserRound } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

type SettingSectionKey = "account" | "privacy" | "notifications" | "security" | "language";

type SettingItem = {
  key: SettingSectionKey;
  label: string;
  description: string;
  icon: typeof UserRound;
};

const settingsItems: SettingItem[] = [
  {
    key: "account",
    label: "ข้อมูลบัญชี",
    description: "ชื่อ บัญชี LINE และสถานะสมาชิกที่ผ่านการยืนยัน",
    icon: UserRound
  },
  {
    key: "privacy",
    label: "ความเป็นส่วนตัวและความยินยอม",
    description: "รอข้อความยินยอมด้านข้อมูลสุขภาพฉบับจริงจากฝ่ายกฎหมาย",
    icon: ShieldCheck
  },
  {
    key: "notifications",
    label: "การแจ้งเตือน",
    description: "การปรึกษา คำสั่งซื้อ ชุมชน และคะแนนสะสม",
    icon: Bell
  },
  {
    key: "security",
    label: "ความปลอดภัย",
    description: "การจัดการเซสชันและการตรวจสอบอุปกรณ์ในอนาคต",
    icon: LockKeyhole
  },
  {
    key: "language",
    label: "ภาษา",
    description: "ประสบการณ์ LINE LIFF ที่ออกแบบโดยใช้ภาษาไทยเป็นหลัก",
    icon: Languages
  }
];

const sectionDetails: Record<SettingSectionKey, { title: string; body: string; rows: Array<{ label: string; value: string }> }> = {
  account: {
    title: "ข้อมูลบัญชี",
    body: "ข้อมูลบัญชีแสดงเฉพาะข้อมูลจำลองที่ปลอดภัย จนกว่าจะเชื่อมต่อข้อมูลลูกค้าจริงจาก LINE LIFF และฐานข้อมูล production",
    rows: [
      { label: "ชื่อที่แสดง", value: "K. Ananya" },
      { label: "สถานะสมาชิก", value: "ผ่านการยืนยัน" },
      { label: "บัญชี LINE", value: "รอการตั้งค่า LINE LIFF จริง" }
    ]
  },
  privacy: {
    title: "ความเป็นส่วนตัวและความยินยอม",
    body: "ส่วนนี้เตรียมไว้สำหรับข้อความ PDPA เงื่อนไขบริการ และความยินยอมด้านข้อมูลสุขภาพเมื่อได้รับเนื้อหาจริงจากลูกค้า",
    rows: [
      { label: "PDPA Privacy Policy", value: "รอเอกสารจากลูกค้า" },
      { label: "Terms of Service", value: "รอเอกสารจากลูกค้า" },
      { label: "Health-data consent", value: "รอข้อความฉบับอนุมัติ" }
    ]
  },
  notifications: {
    title: "การแจ้งเตือน",
    body: "เตรียมกลุ่มการแจ้งเตือนหลักของลูกค้าไว้ก่อน โดยยังไม่เปิดการตั้งค่า production channel จนกว่าจะได้รับข้อมูลจริง",
    rows: [
      { label: "การปรึกษา", value: "เปิด" },
      { label: "คำสั่งซื้อและการชำระเงิน", value: "เปิด" },
      { label: "ชุมชนและคะแนนสะสม", value: "เปิด" }
    ]
  },
  security: {
    title: "ความปลอดภัย",
    body: "เซสชันและการเข้าถึงข้อมูลสำคัญยังอยู่หลังระบบยืนยันตัวตน และจะเพิ่มการตรวจสอบอุปกรณ์เมื่อเข้าสู่ production",
    rows: [
      { label: "สถานะเซสชัน", value: "ใช้งานอยู่" },
      { label: "การตรวจสอบอุปกรณ์", value: "เตรียมไว้สำหรับอนาคต" },
      { label: "ข้อมูลสุขภาพ", value: "จำกัดเฉพาะเส้นทางที่เข้าสู่ระบบแล้ว" }
    ]
  },
  language: {
    title: "ภาษา",
    body: "ประสบการณ์ลูกค้าถูกจัดวางให้ใช้ภาษาไทยเป็นหลัก เพื่อให้เหมาะกับ LINE LIFF และ workflow การดูแลลูกค้าในไทย",
    rows: [
      { label: "ภาษาหลัก", value: "ไทย" },
      { label: "รูปแบบวันที่", value: "ไทย" },
      { label: "สกุลเงิน", value: "บาทไทย" }
    ]
  }
};

export function ProfileSettings({ section }: { section?: string }) {
  const activeSection = getActiveSection(section);
  const activeDetail = activeSection ? sectionDetails[activeSection] : null;

  return (
    <div className="min-h-dvh w-full overflow-hidden bg-[linear-gradient(180deg,#e0f2f1_0%,#f7f9fb_58%,#eef3f4_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <header className="sticky top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,123,131,0.06)] backdrop-blur-[24px]">
        <div className="mx-auto flex h-[82px] w-full max-w-mobile items-center gap-4 px-7">
          <Link href="/profile" aria-label="กลับไปหน้าโปรไฟล์" className="flex size-10 items-center justify-center rounded-full text-primary">
            <ArrowLeft aria-hidden="true" className="size-6" strokeWidth={2.4} />
          </Link>
          <div className="min-w-0">
            <p className="text-[22px] font-bold tracking-wide text-primary">ตั้งค่า</p>
            <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-[#3e494a]/60">การจัดการโปรไฟล์</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-mobile px-7 pt-8">
        <section className="rounded-[28px] border border-white/40 bg-white/60 p-6 shadow-[0_16px_45px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
          <div className="mb-5 flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg">
              <Settings aria-hidden="true" className="size-7" strokeWidth={2.4} />
            </span>
            <div>
              <h1 className="text-[24px] font-extrabold leading-7 text-[#191c1e]">K. Ananya</h1>
              <p className="mt-1 text-sm font-medium text-[#3e494a]">การตั้งค่าสมาชิกที่ผ่านการยืนยัน</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[#3e494a]">
            ข้อมูลโปรไฟล์ ความยินยอม การแจ้งเตือน และการจัดการเซสชันถูกเก็บไว้หลังเส้นทางที่ต้องเข้าสู่ระบบแล้วเท่านั้น
          </p>
        </section>
      </main>

      <BottomSheet
        title={activeDetail?.title ?? "ตั้งค่าโปรไฟล์"}
        description={
          activeDetail?.body ??
          "ตรวจสอบการตั้งค่าของลูกค้า โดยไม่แสดงข้อมูลสำคัญนอกพื้นที่โปรไฟล์ที่ผ่านการยืนยันตัวตนแล้ว"
        }
        dismissHref={activeDetail ? "/profile/settings" : "/profile"}
        bottomClassName="bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
        footer={<p className="text-xs leading-5 text-[#6e797a]">ข้อความยินยอมสำหรับใช้งานจริงยังรอการอนุมัติจากฝ่ายกฎหมายของลูกค้า</p>}
      >
        {activeDetail ? <SettingDetailRows rows={activeDetail.rows} /> : <SettingMenu />}
      </BottomSheet>
    </div>
  );
}

function SettingMenu() {
  return settingsItems.map((item) => (
    <Link
      key={item.key}
      href={`/profile/settings?section=${item.key}`}
      className="flex min-h-[76px] w-full items-center gap-4 rounded-[20px] border border-white/50 bg-white/70 p-4 text-left shadow-sm transition-colors hover:bg-white active:scale-[0.99]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e8fbf7] text-primary">
        <item.icon aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#191c1e]">{item.label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#3e494a]/75">{item.description}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-[#bdc9ca]" />
    </Link>
  ));
}

function SettingDetailRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="rounded-[18px] border border-white/50 bg-white/70 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">{row.label}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-[#191c1e]">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function getActiveSection(section: string | undefined): SettingSectionKey | null {
  if (section === "account" || section === "privacy" || section === "notifications" || section === "security" || section === "language") {
    return section;
  }

  return null;
}
