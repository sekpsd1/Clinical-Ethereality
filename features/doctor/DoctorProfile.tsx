import { ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/features/profile/LogoutButton";
import { ProfileAvatar } from "@/features/profile/ProfileAvatar";

export type DoctorProfileData = {
  displayName: string;
  avatarUrl: string | null;
};

export function DoctorProfile({ data }: { data: DoctorProfileData }) {
  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-white/40 bg-white/75 p-6 text-center shadow-payment-card backdrop-blur-topbar">
        <div className="mx-auto flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-primary/10 bg-[#e3f3f1] shadow-avatar">
          <div className="relative h-full w-full overflow-hidden rounded-full">
            <ProfileAvatar avatarUrl={data.avatarUrl} displayName={data.displayName} />
          </div>
        </div>

        <p className="mt-5 text-label font-bold uppercase tracking-[0.16em] text-primary/60">โปรไฟล์แพทย์</p>
        <h2 className="mt-1 truncate font-headline text-2xl font-bold text-text">{data.displayName}</h2>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-bold text-primary">
          <ShieldCheck aria-hidden="true" className="size-4" strokeWidth={2.2} />
          บัญชีแพทย์ที่เชื่อมต่อกับ LINE
        </div>
      </section>

      <section className="rounded-[20px] border border-border/60 bg-white/75 p-5 shadow-payment-card backdrop-blur-topbar">
        <h2 className="font-headline text-lg font-bold text-text">การใช้งานบัญชี</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          ออกจากระบบเมื่อต้องการเปลี่ยนบัญชี การดำเนินการนี้มีผลเฉพาะ session ในเบราว์เซอร์นี้
        </p>
        <LogoutButton
          redirectTo="/auth/line?next=%2Fdoctor%2Fconsultations"
          className="mt-5 min-h-12 w-full justify-center rounded-full border border-danger/20 bg-danger/10 px-5 text-sm hover:bg-danger/15 hover:no-underline"
        />
      </section>
    </div>
  );
}
