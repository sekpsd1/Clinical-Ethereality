import type { Metadata } from "next";
import { LegalSection, PublicLegalPage } from "@/features/legal/PublicLegalPage";
import { clinicController } from "@/features/legal/public-documents";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | Clinical lab service",
  alternates: { canonical: "/privacy-policy" }
};

export default function PrivacyPolicyPage() {
  return (
    <PublicLegalPage
      eyebrow="Privacy Policy"
      title="นโยบายความเป็นส่วนตัว"
      intro={`${clinicController.name} เป็นผู้ควบคุมข้อมูลส่วนบุคคลสำหรับบริการบน Clinical lab service`}
    >
      <LegalSection title="ข้อมูลที่เราใช้">
        <p>เราใช้ข้อมูลบัญชีและการติดต่อ ข้อมูลการจองและชำระเงิน ตลอดจนข้อมูลสุขภาพ การสนทนา ใบสั่งยา และไฟล์ที่จำเป็นต่อการให้บริการอย่างปลอดภัย</p>
      </LegalSection>
      <LegalSection title="วัตถุประสงค์และการเปิดเผย">
        <p>ข้อมูลใช้เพื่อยืนยันตัวตน จัดการนัดหมาย ให้คำปรึกษา จัดยา ชำระเงิน รักษาความปลอดภัย ตรวจสอบเหตุการณ์ และปฏิบัติตามกฎหมาย โดยเปิดเผยแก่ผู้ให้บริการที่จำเป็นและมีขอบเขตเหมาะสมเท่านั้น</p>
      </LegalSection>
      <LegalSection title="การรักษาความปลอดภัยและระยะเวลาเก็บ">
        <p>ข้อมูลสุขภาพและหลักฐานการให้บริการถูกจำกัดสิทธิ์และมีบันทึกตรวจสอบ เสียง วิดีโอ และประวัติแชทจาก Telemedicine เก็บรักษา 5 ปี นับจากวันที่บันทึก เว้นแต่กฎหมายกำหนดหรืออนุญาตเป็นอย่างอื่น</p>
      </LegalSection>
      <LegalSection title="สิทธิของเจ้าของข้อมูล">
        <p>ท่านอาจขอเข้าถึง แก้ไข คัดค้าน จำกัด ลบ ถ่ายโอน หรือถอนความยินยอมได้ตามสิทธิและข้อยกเว้นของกฎหมาย โดยติดต่อแอดมินทางอีเมลหรือโทรศัพท์ด้านล่าง</p>
        <p>การถอนความยินยอมมีผลต่อการประมวลผลในอนาคต ไม่กระทบความชอบด้วยกฎหมายของการประมวลผลก่อนถอน และอาจทำให้ไม่สามารถใช้บริการที่จำเป็นต้องอาศัยข้อมูลดังกล่าวได้</p>
      </LegalSection>
    </PublicLegalPage>
  );
}
