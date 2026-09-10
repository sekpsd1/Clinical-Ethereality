import type { Metadata } from "next";
import { LegalSection, PublicLegalPage } from "@/features/legal/PublicLegalPage";
import { telemedicineConsentDocument } from "@/features/legal/public-documents";

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
      <LegalSection title="ขอบเขตความยินยอมรายการเดียว">
        <p>ท่านยินยอมรับคำปรึกษาทางไกล และยินยอมให้ระบบบันทึกเสียง วิดีโอ และประวัติแชทโดยอัตโนมัติทุกเคส เพื่อความต่อเนื่องในการดูแล ความปลอดภัย การตรวจสอบ และหน้าที่ตามกฎหมาย</p>
      </LegalSection>
      <LegalSection title="ข้อจำกัดของบริการ">
        <p>Telemedicine อาจไม่เหมาะกับทุกอาการและไม่ทดแทนการตรวจร่างกายในทุกกรณี หากเป็นเหตุฉุกเฉินให้โทร 1669 หรือไปสถานพยาบาลทันที</p>
      </LegalSection>
      <LegalSection title="อายุและผู้ให้ความยินยอม">
        <p>ผู้ใช้ที่มีอายุ 18 ปีขึ้นไปให้ความยินยอมด้วยตนเองได้ ผู้มีอายุต่ำกว่า 18 ปีห้ามให้ความยินยอมด้วยตนเองและจำเป็นต้องได้รับความยินยอมจากผู้ปกครองตามกฎหมาย โปรดติดต่อแอดมินเพื่อรับคำแนะนำ</p>
      </LegalSection>
      <LegalSection title="การเก็บรักษาและการเข้าถึง">
        <p>เสียง วิดีโอ และประวัติแชทเก็บรักษา 5 ปี การเปิดดูหรือดาวน์โหลดจำกัดเฉพาะ Admin และแพทย์ที่ได้รับมอบหมายให้การปรึกษานั้น ทุกครั้งมี audit log และไม่มี URL บันทึกที่เปิดเผยต่อสาธารณะ</p>
      </LegalSection>
      <LegalSection title="การถอนความยินยอม">
        <p>ระยะนี้ท่านแจ้งถอนความยินยอมกับแอดมินทางอีเมลหรือโทรศัพท์ได้ การถอนมีผลต่ออนาคต ไม่ลบหรือทำให้การประมวลผลก่อนถอนหมดความชอบด้วยกฎหมาย และอาจทำให้ไม่สามารถใช้บริการที่จำเป็นต้องใช้ข้อมูลนี้ได้</p>
      </LegalSection>
    </PublicLegalPage>
  );
}
