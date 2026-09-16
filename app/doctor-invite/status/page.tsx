import type { Metadata } from "next";
import { DoctorInviteLanding } from "@/features/staff-invite/DoctorInviteLanding";

export const metadata: Metadata = {
  title: "สถานะคำเชิญแพทย์ | Clinical Ethereality",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default function DoctorInviteStatusPage() {
  return <DoctorInviteLanding />;
}
