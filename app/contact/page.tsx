import type { Metadata } from "next";
import { LegalSection, PublicLegalPage } from "@/features/legal/PublicLegalPage";
import { clinicController } from "@/features/legal/public-documents";

export const metadata: Metadata = {
  title: "ติดต่อเรา | Clinical lab service",
  alternates: { canonical: "/contact" }
};

export default function ContactPage() {
  return (
    <PublicLegalPage
      eyebrow="Contact"
      title="ช่องทางติดต่อ"
      intro="ติดต่อทีมงานเรื่องบริการ การใช้สิทธิข้อมูลส่วนบุคคล หรือการถอนความยินยอมได้โดยไม่ต้องเข้าสู่ระบบ"
    >
      <LegalSection title="ผู้ให้บริการและผู้ควบคุมข้อมูล">
        <p className="font-bold text-[#191c1e]">{clinicController.name}</p>
        <p>{clinicController.address}</p>
      </LegalSection>
      <LegalSection title="อีเมลและโทรศัพท์">
        <p>อีเมล: <a className="font-bold text-primary" href={`mailto:${clinicController.email}`}>{clinicController.email}</a></p>
        <p>โทรศัพท์: {clinicController.phones.join(", ")}</p>
      </LegalSection>
      <LegalSection title="การถอนความยินยอม">
        <p>ระยะนี้สามารถแจ้งถอนความยินยอมกับแอดมินผ่านอีเมลหรือโทรศัพท์ การถอนมีผลต่ออนาคต ไม่ลบประวัติการประมวลผลก่อนถอน และอาจทำให้ใช้บริการที่จำเป็นต้องใช้ข้อมูลนั้นไม่ได้</p>
      </LegalSection>
    </PublicLegalPage>
  );
}
