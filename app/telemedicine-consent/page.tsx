import type { Metadata } from "next";
import { LegalSection, PublicLegalPage } from "@/features/legal/PublicLegalPage";
import { telemedicineConsentDocument } from "@/features/legal/public-documents";
import { TelemedicineConsentContent } from "@/features/consultations/consent/TelemedicineConsentContent";

export const metadata: Metadata = {
  title: "ความยินยอม Telemedicine | Clinical lab service",
  alternates: { canonical: "/telemedicine-consent" }
};

export default function TelemedicineConsentPage() {
  return (
    <PublicLegalPage
      eyebrow={`Telemedicine Consent · ฉบับ ${telemedicineConsentDocument.version}`}
      title="ความยินยอมรับบริการ Telemedicine และการบันทึก"
      intro="โปรดอ่านก่อนยืนยันทุกการจอง ความยินยอมนี้ผูกกับนัดหมายครั้งนั้นและไม่สามารถนำความยินยอมจากการจองเก่ามาใช้แทนได้"
    >
      <TelemedicineConsentContent />
      <LegalSection title="เงื่อนไขการยืนยันในระบบปัจจุบัน">
        <p>การจองแต่ละครั้งต้องยอมรับความยินยอมฉบับปัจจุบันใหม่ ความยินยอมจากการจองเก่าใช้แทนไม่ได้ ผู้ใช้ที่มีอายุ 18 ปีขึ้นไปให้ความยินยอมด้วยตนเองได้</p>
        <p>ผู้มีอายุต่ำกว่า 18 ปีห้ามให้ความยินยอมด้วยตนเองและจำเป็นต้องได้รับความยินยอมจากผู้ปกครองตามกฎหมาย โปรดติดต่อแอดมินเพื่อรับคำแนะนำ</p>
      </LegalSection>
      <LegalSection title="ข้อจำกัดของบริการ">
        <p>Telemedicine อาจไม่เหมาะกับทุกอาการและไม่ทดแทนการตรวจร่างกายในทุกกรณี หากเป็นเหตุฉุกเฉินให้โทร 1669 หรือไปสถานพยาบาลทันที</p>
      </LegalSection>
      <LegalSection title="ช่องทางถอนความยินยอมที่รองรับปัจจุบัน">
        <p>ระยะนี้ท่านแจ้งถอนความยินยอมกับแอดมินทางอีเมลหรือโทรศัพท์ได้ การถอนมีผลต่ออนาคต ไม่กระทบความชอบด้วยกฎหมายของการประมวลผลก่อนถอน และอาจทำให้ไม่สามารถใช้บริการที่จำเป็นต้องใช้ข้อมูลนี้ได้</p>
      </LegalSection>
    </PublicLegalPage>
  );
}
