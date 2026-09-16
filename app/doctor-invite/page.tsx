import type { Metadata } from "next";
import { DoctorInviteLanding } from "@/features/staff-invite/DoctorInviteLanding";

export const metadata: Metadata = {
  title: "คำเชิญแพทย์ | Clinical Ethereality",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default function DoctorInvitePage() {
  return <DoctorInviteLanding />;
}
