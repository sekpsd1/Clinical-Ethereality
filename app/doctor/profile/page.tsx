import { DoctorProfile } from "@/features/doctor/DoctorProfile";
import { requireRoleSession } from "@/lib/auth/guards";

export default async function DoctorProfilePage() {
  const session = await requireRoleSession(["doctor"], "/doctor/profile");

  return (
    <DoctorProfile
      data={{
        displayName: session.displayName?.trim() || "แพทย์ผู้ให้คำปรึกษา",
        avatarUrl: session.pictureUrl?.trim() || null
      }}
    />
  );
}
