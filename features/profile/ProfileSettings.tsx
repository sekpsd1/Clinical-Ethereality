import Link from "next/link";
import { ArrowLeft, Bell, ChevronRight, Languages, LockKeyhole, Settings, ShieldCheck, UserRound } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

const settingsItems = [
  {
    label: "Account profile",
    description: "Name, LINE account, and verified member status",
    icon: UserRound
  },
  {
    label: "Privacy and consent",
    description: "Health-data consent placeholders until legal wording arrives",
    icon: ShieldCheck
  },
  {
    label: "Notifications",
    description: "Consultation, order, community, and reward alerts",
    icon: Bell
  },
  {
    label: "Security",
    description: "Session controls and future device review",
    icon: LockKeyhole
  },
  {
    label: "Language",
    description: "Thai-first LINE LIFF experience",
    icon: Languages
  }
];

export function ProfileSettings() {
  return (
    <div className="min-h-dvh w-full overflow-hidden bg-[linear-gradient(180deg,#e0f2f1_0%,#f7f9fb_58%,#eef3f4_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <header className="sticky top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,123,131,0.06)] backdrop-blur-[24px]">
        <div className="mx-auto flex h-[82px] w-full max-w-mobile items-center gap-4 px-7">
          <Link href="/profile" aria-label="Back to profile" className="flex size-10 items-center justify-center rounded-full text-primary">
            <ArrowLeft aria-hidden="true" className="size-6" strokeWidth={2.4} />
          </Link>
          <div className="min-w-0">
            <p className="text-[22px] font-bold tracking-wide text-primary">Settings</p>
            <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-[#3e494a]/60">Profile controls</p>
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
              <p className="mt-1 text-sm font-medium text-[#3e494a]">Verified member settings</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[#3e494a]">
            Sensitive profile, consent, notification, and session controls stay behind authenticated customer routes.
          </p>
        </section>
      </main>

      <BottomSheet
        title="Profile settings"
        description="Review customer-facing settings without exposing sensitive records outside the authenticated profile area."
        dismissHref="/profile"
        bottomClassName="bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
        footer={<p className="text-xs leading-5 text-[#6e797a]">Production consent wording remains pending client legal approval.</p>}
      >
        {settingsItems.map((item) => (
          <button
            key={item.label}
            type="button"
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
          </button>
        ))}
      </BottomSheet>
    </div>
  );
}
