import type { ConsentType } from "@prisma/client";

export type LegalDocument = {
  type: ConsentType;
  title: string;
  version: string;
  required: boolean;
  summary: string;
  bullets: string[];
};

export const legalDocuments = [
  {
    type: "privacy_policy",
    title: "Privacy Policy / PDPA",
    version: "2026-05-20-draft",
    required: true,
    summary:
      "บริษัท บางกอก ไซโตเจเนติกซ์ เซ็นเตอร์ จำกัด เป็นผู้ควบคุมข้อมูลส่วนบุคคล และใช้ร่าง PDPA ปัจจุบันไปก่อน โดยคาดว่าจะมีการแก้ไขภายหลัง",
    bullets: [
      "เก็บข้อมูลบัญชี ที่อยู่จัดส่ง ข้อมูลชำระเงินเท่าที่จำเป็น และข้อมูลสุขภาพเมื่อได้รับความยินยอม",
      "ใช้ข้อมูลเพื่อบริการสั่งซื้อ จัดส่ง ป้องกันการทุจริต ความปลอดภัย และปฏิบัติตามกฎหมาย",
      "อาจเปิดเผยข้อมูลเท่าที่จำเป็นให้ผู้ขนส่ง ผู้ตรวจสลิป ผู้ให้บริการ cloud และหน่วยงานรัฐตามกฎหมาย",
      "เจ้าของข้อมูลมีสิทธิ์เข้าถึง แก้ไข ลบ คัดค้าน ถ่ายโอน และถอนความยินยอมตาม PDPA"
    ]
  },
  {
    type: "terms_of_service",
    title: "Terms of Service",
    version: "2026-05-20-draft",
    required: true,
    summary:
      "ข้อกำหนดการใช้งาน BCC App สำหรับ consultation, home test kit, online pharmacy, vitamins and supplements ใช้ร่างปัจจุบันไปก่อน",
    bullets: [
      "ผู้ใช้ต้องให้ข้อมูลจริงและรับทราบว่าบริการทางไกลไม่แทนการพบแพทย์ในทุกกรณี",
      "บริการฉุกเฉินต้องโทร 1669 หรือไปสถานพยาบาล ไม่ใช้แอปนี้",
      "ชำระผ่าน PromptPay หรือโอนเงินพร้อมแนบสลิป และระบบตรวจสลิปปลอม/ซ้ำ/ยอดไม่ตรง",
      "การยกเลิกและคืนเงินใช้กฎตามร่างนโยบายที่ลูกค้าส่งมา"
    ]
  },
  {
    type: "health_data",
    title: "Health Data Consent",
    version: "2026-05-20-draft",
    required: true,
    summary: "ความยินยอมเก็บและประมวลผลข้อมูลสุขภาพเพื่อให้บริการยา วิตามิน และคำแนะนำที่ปลอดภัย",
    bullets: [
      "ข้อมูลสุขภาพรวมโรคประจำตัว ประวัติแพ้ยา รายการยาปัจจุบัน ใบสั่งยา และประวัติสั่งซื้อ",
      "ใช้เพื่อตรวจความเหมาะสมของยา ให้คำแนะนำเภสัชกรรม และแจ้งเตือนความเสี่ยง",
      "เภสัชกรที่ได้รับอนุญาตเท่านั้นที่เข้าถึงข้อมูลสุขภาพได้",
      "บันทึกความยินยอมพร้อมวันเวลาและข้อมูล session ตามหลัก PDPA"
    ]
  },
  {
    type: "teleconsultation",
    title: "Teleconsultation Consent",
    version: "2026-05-20-draft",
    required: true,
    summary: "ความยินยอมใช้บริการปรึกษาแพทย์ทางไกลผ่านวิดีโอหรือแชท พร้อมรับทราบข้อจำกัดของบริการ",
    bullets: [
      "ยินยอมให้แพทย์เข้าถึงประวัติสุขภาพ ประวัติยา และข้อมูลที่เกี่ยวข้อง",
      "รับทราบว่าบริการนี้ไม่เหมาะกับภาวะฉุกเฉินและไม่แทนการพบแพทย์ทุกกรณี",
      "ยินยอมให้บันทึกข้อความ เสียง หรือวิดีโอเพื่อคุณภาพ ความปลอดภัย และข้อกำหนดทางกฎหมาย",
      "ยินยอมให้ส่งต่อข้อมูลแก่ผู้เชี่ยวชาญที่เกี่ยวข้องเมื่อจำเป็นเพื่อความปลอดภัย"
    ]
  },
  {
    type: "prescription_fulfillment",
    title: "Prescription And Pharmacy Fulfillment Consent",
    version: "2026-05-20-draft",
    required: true,
    summary: "ความยินยอมเรื่องใบสั่งยา การตรวจโดยเภสัชกร การจัดเตรียมยา และการจัดส่งยา",
    bullets: [
      "ยา Rx ต้องมีใบสั่งแพทย์อายุไม่เกิน 30 วัน และเภสัชกรตรวจสอบก่อนอนุมัติ",
      "ยาควบคุมพิเศษไม่สั่งผ่านแอป ต้องรับที่ร้านยาหรือโรงพยาบาลตามกฎหมาย",
      "ยินยอมเปิดเผยข้อมูลจัดส่งแก่บริษัทขนส่งที่ได้รับอนุญาตเพื่อจัดส่งยาเท่านั้น",
      "รับทราบว่ายาที่เปิดบรรจุภัณฑ์แล้วหรือจ่ายถูกต้องตามใบสั่งแพทย์อาจไม่อยู่ในเงื่อนไขคืนเงิน"
    ]
  }
] as const satisfies LegalDocument[];

export function getLegalDocument(type: ConsentType): LegalDocument | null {
  return legalDocuments.find((document) => document.type === type) ?? null;
}

export function getRequiredLegalDocuments(): LegalDocument[] {
  return legalDocuments.filter((document) => document.required);
}
