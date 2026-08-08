import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Bookmark,
  ClipboardList,
  Pill,
  Settings,
  ShieldCheck,
  Truck
} from "lucide-react";
import { ProfileSettingsItem } from "@/components/ui/ProfileSettingsItem";
import { LogoutButton } from "@/features/profile/LogoutButton";
import { ProfileAvatar } from "@/features/profile/ProfileAvatar";
import type { CustomerProfileData } from "@/features/profile/types";

type ProfileMenuItem = {
  label: string;
  icon: typeof ClipboardList;
  href?: string;
};

const profileMenuItems: ProfileMenuItem[] = [
  { label: "ประวัติคำแนะนำจากแพทย์", icon: ClipboardList, href: "/consult/advice-log" },
  { label: "รายการยาของฉัน", icon: Pill, href: "/consult/prescriptions" },
  { label: "บทความที่บันทึกไว้", icon: Bookmark, href: "/profile/saved-articles" },
  { label: "ที่อยู่จัดส่ง", icon: Truck, href: "/profile/shipping-addresses" }
];

export function UserProfile({ data }: { data: CustomerProfileData }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <ProfileHeader />

      <main>
        <section className="relative flex min-h-[280px] flex-col items-center justify-end overflow-hidden bg-[linear-gradient(135deg,#006067_0%,#008080_100%)] pb-10 pt-7">
          <div className="absolute left-[-50px] top-[-50px] size-64 rounded-full bg-[#96f1fa]/20 blur-3xl" />
          <div className="absolute bottom-[-20px] right-[-20px] size-48 rounded-full bg-[#d0fbff]/10 blur-2xl" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-4">
              <div className="flex size-28 items-center justify-center overflow-hidden rounded-full border-4 border-white/30 bg-[#142326] p-1 shadow-2xl">
                <div className="relative h-full w-full overflow-hidden rounded-full">
                  <ProfileAvatar avatarUrl={data.avatarUrl} displayName={data.displayName} />
                </div>
              </div>
              <div className="absolute bottom-0 right-2 flex size-9 items-center justify-center rounded-full bg-white text-primary shadow-md">
                <ShieldCheck aria-hidden="true" className="size-5 fill-primary text-white" />
              </div>
            </div>

            <h1 className="max-w-[20rem] truncate text-[26px] font-extrabold tracking-tight text-white">{data.displayName}</h1>
            <div className="mt-2 rounded-full border border-white/30 bg-white/20 px-4 py-1.5 backdrop-blur-md">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-white">{data.memberStatus}</span>
            </div>
          </div>
        </section>

        <div className="relative z-20 -mt-7 space-y-6 px-4">
          <section className="grid grid-cols-2 rounded-[24px] border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
            <div className="flex flex-col gap-2 border-r border-[#bdc9ca]/20 text-center">
              <span className="text-xs font-bold uppercase tracking-tight text-[#3e494a]">คำแนะนำ</span>
              <span className="text-2xl font-bold text-primary">{data.adviceCount}</span>
            </div>
            <div className="flex flex-col gap-2 text-center">
              <span className="text-xs font-bold uppercase tracking-tight text-[#3e494a]">โพสต์</span>
              <span className="text-2xl font-bold text-primary">{data.postCount}</span>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="px-2 text-sm font-bold uppercase tracking-[0.16em] text-primary/60">การตั้งค่าทั่วไป</h2>

            <div className="space-y-3">
              {profileMenuItems.map((item) => (
                <ProfileSettingsItem
                  key={item.label}
                  label={item.label}
                  icon={item.icon}
                  iconFill={item.icon === Bookmark ? "#006067" : "none"}
                  href={item.href}
                />
              ))}
            </div>
          </section>

          <section className="pb-10 pt-6 text-center">
            <LogoutButton />
            <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[#6e797a]">
              เวอร์ชันแอป 2.4.0 Clinical Edition
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function ProfileHeader() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,123,131,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-16 w-full max-w-mobile items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/community" aria-label="กลับไปหน้าชุมชน" className="flex size-10 items-center justify-center rounded-full text-primary">
            <ArrowLeft aria-hidden="true" className="size-6" strokeWidth={2.4} />
          </Link>
          <p className="text-[29px] font-bold tracking-wide text-primary">โปรไฟล์</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/notifications" aria-label="การแจ้งเตือน" className="relative flex size-10 items-center justify-center rounded-full text-primary">
            <Bell aria-hidden="true" className="size-5" strokeWidth={2.4} />
            <span className="absolute right-1 top-1 size-2.5 rounded-full bg-[#ba1a1a] ring-2 ring-white" />
          </Link>
          <Link href="/profile/settings" aria-label="ตั้งค่าโปรไฟล์" className="flex size-10 items-center justify-center rounded-full text-primary">
            <Settings aria-hidden="true" className="size-6 fill-primary/10" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </header>
  );
}
