import type { Metadata } from "next";
import { RecordingExternalHandoffPage } from "@/features/consultations/recordings/RecordingExternalHandoffPage";

export const metadata: Metadata = {
  title: "เปิดบันทึกการปรึกษา",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default function RecordingHandoffPage() {
  return <RecordingExternalHandoffPage />;
}
