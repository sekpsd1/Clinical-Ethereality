import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Bell,
  ChevronRight,
  ClipboardList,
  LogOut,
  Pill,
  Settings,
  ShieldCheck,
  Truck
} from "lucide-react";

type ProfileMenuItem = {
  label: string;
  icon: typeof ClipboardList;
};

const profileMenuItems: ProfileMenuItem[] = [
  { label: "ประวัติคำแนะนำจากแพทย์", icon: ClipboardList },
  { label: "รายการยาของฉัน", icon: Pill },
  { label: "บทความที่บันทึกไว้", icon: Bookmark },
  { label: "ที่อยู่จัดส่ง", icon: Truck }
];

export function UserProfile() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <ProfileHeader />

      <main>
        <section className="relative flex min-h-[306px] flex-col items-center justify-end overflow-hidden bg-[linear-gradient(135deg,#006067_0%,#008080_100%)] pb-12 pt-8">
          <div className="absolute left-[-50px] top-[-50px] size-64 rounded-full bg-[#96f1fa]/20 blur-3xl" />
          <div className="absolute bottom-[-20px] right-[-20px] size-48 rounded-full bg-[#d0fbff]/10 blur-2xl" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-4">
              <div className="flex size-32 items-center justify-center overflow-hidden rounded-full border-4 border-white/30 bg-[#142326] p-1 shadow-2xl">
                <ProfilePortrait />
              </div>
              <div className="absolute bottom-0 right-2 flex size-9 items-center justify-center rounded-full bg-white text-primary shadow-md">
                <ShieldCheck aria-hidden="true" className="size-5 fill-primary text-white" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white">K. Ananya</h1>
            <div className="mt-3 rounded-full border border-white/30 bg-white/20 px-5 py-2 backdrop-blur-md">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-white">Verified Member</span>
            </div>
          </div>
        </section>

        <div className="relative z-20 -mt-8 space-y-8 px-7">
          <section className="grid grid-cols-2 rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-[0_10px_30px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
            <div className="flex flex-col gap-2 border-r border-[#bdc9ca]/20 text-center">
              <span className="text-xs font-bold uppercase tracking-tight text-[#3e494a]">Advice</span>
              <span className="text-2xl font-bold text-primary">12</span>
            </div>
            <div className="flex flex-col gap-2 text-center">
              <span className="text-xs font-bold uppercase tracking-tight text-[#3e494a]">Posts</span>
              <span className="text-2xl font-bold text-primary">5</span>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="px-2 text-sm font-bold uppercase tracking-[0.16em] text-primary/60">General Settings</h2>

            <div className="space-y-4">
              {profileMenuItems.map((item) => (
                <ProfileMenuButton key={item.label} item={item} />
              ))}
            </div>
          </section>

          <section className="pb-12 pt-8 text-center">
            <button type="button" className="inline-flex items-center gap-2 font-semibold text-[#ba1a1a] underline-offset-8 hover:underline">
              <LogOut aria-hidden="true" className="size-4" />
              ออกจากระบบ
            </button>
            <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[#6e797a]">
              App Version 2.4.0 Clinical Edition
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
      <div className="mx-auto flex h-[95px] w-full max-w-mobile items-center justify-between px-7">
        <div className="flex items-center gap-4">
          <Link href="/community" aria-label="Back to community" className="flex size-10 items-center justify-center rounded-full text-primary">
            <ArrowLeft aria-hidden="true" className="size-6" strokeWidth={2.4} />
          </Link>
          <p className="text-[29px] font-bold tracking-wide text-primary">Profile</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/notifications" aria-label="Notifications" className="relative flex size-10 items-center justify-center rounded-full text-primary">
            <Bell aria-hidden="true" className="size-6" strokeWidth={2.4} />
            <span className="absolute right-1 top-1 size-2.5 rounded-full bg-[#ba1a1a] ring-2 ring-white" />
          </Link>
          <button type="button" aria-label="Profile settings" className="flex size-10 items-center justify-center rounded-full text-primary">
            <Settings aria-hidden="true" className="size-7 fill-primary/10" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </header>
  );
}

function ProfileMenuButton({ item }: { item: ProfileMenuItem }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className="flex min-h-[118px] w-full items-center justify-between rounded-[24px] border border-white/40 bg-white/70 p-7 shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px] transition-colors hover:bg-white/90 active:scale-[0.98]"
    >
      <span className="flex min-w-0 items-center gap-6">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#e8fbf7] text-primary">
          <Icon aria-hidden="true" className="size-7" fill={item.icon === Bookmark ? "#006067" : "none"} />
        </span>
        <span className="truncate text-left text-[18px] font-medium leading-6 text-[#3e494a]">{item.label}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-6 shrink-0 text-[#bdc9ca]" />
    </button>
  );
}

function ProfilePortrait() {
  return (
    <div
      role="img"
      aria-label="K. Ananya profile portrait"
      className="relative h-full w-full overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_25%,#5a3827_0%,#111827_52%,#0b1113_100%)]"
    >
      <div className="absolute left-[29%] top-[18%] h-[47%] w-[42%] rounded-full bg-[#d49b72]" />
      <div className="absolute left-[25%] top-[13%] h-[48%] w-[52%] rounded-t-full bg-[#302016]" />
      <div className="absolute left-[36%] top-[34%] h-[7%] w-[7%] rounded-full bg-[#3b2a22]" />
      <div className="absolute right-[34%] top-[34%] h-[7%] w-[7%] rounded-full bg-[#3b2a22]" />
      <div className="absolute left-[43%] top-[44%] h-[9%] w-[8%] rounded-full border-r-2 border-[#936247]" />
      <div className="absolute left-[40%] top-[55%] h-[4%] w-[20%] rounded-full bg-[#9f4f47]" />
      <div className="absolute bottom-0 left-[19%] h-[38%] w-[62%] rounded-t-[34px] bg-[#7bb3aa]" />
    </div>
  );
}
