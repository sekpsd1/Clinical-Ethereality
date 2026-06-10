import type { AssessmentDuration, AssessmentRecommendation, AssessmentSymptom } from "@/features/consultations/assessment/types";

const clientDoctorSpecialty = "สูตินรีเวช และเวชศาสตร์มารดาและทารกในครรภ์";

export const symptomLabels: Record<AssessmentSymptom, string> = {
  headache: "ปวดหัว",
  fever: "ไข้/หนาวสั่น",
  cough: "ไอ/เจ็บคอ",
  other: "อื่นๆ"
};

export const durationLabels: Record<AssessmentDuration, string> = {
  less24h: "น้อยกว่า 24 ชม.",
  "1-3days": "1-3 วัน",
  more3days: "มากกว่า 3 วัน"
};

const recommendationBySymptom: Record<AssessmentSymptom, AssessmentRecommendation> = {
  headache: {
    topic: "อาการปวดหัว",
    specialty: clientDoctorSpecialty,
    reason:
      "เราแนะนำให้เริ่มจากแพทย์เทเลเมดิซีนของคลินิกเพื่อประเมินอาการเบื้องต้น ซักประวัติ และแนะนำว่าควรดูแลต่อหรือพบแพทย์เฉพาะทางเพิ่มเติมหรือไม่"
  },
  fever: {
    topic: "ไข้หรือหนาวสั่น",
    specialty: clientDoctorSpecialty,
    reason:
      "เราแนะนำให้เริ่มจากแพทย์เทเลเมดิซีนของคลินิกเพื่อประเมินความรุนแรงของอาการ ตรวจประวัติร่วม และแนะนำแนวทางดูแลที่เหมาะสมก่อนเลือกขั้นตอนถัดไป"
  },
  cough: {
    topic: "ไอหรือเจ็บคอ",
    specialty: clientDoctorSpecialty,
    reason:
      "เราแนะนำให้เริ่มจากแพทย์เทเลเมดิซีนของคลินิกเพื่อประเมินอาการระบบทางเดินหายใจเบื้องต้น และแนะนำว่าควรติดตามอาการหรือรับการตรวจเพิ่มเติมหรือไม่"
  },
  other: {
    topic: "อาการอื่นๆ",
    specialty: clientDoctorSpecialty,
    reason:
      "เราแนะนำให้เริ่มจากแพทย์เทเลเมดิซีนของคลินิกเพื่อคัดกรองอาการและวางแนวทางดูแลต่อ โดยยังสามารถเลือกแพทย์เองได้เสมอ"
  }
};

export function getAssessmentRecommendation(symptom: AssessmentSymptom, duration: AssessmentDuration): AssessmentRecommendation {
  const base = recommendationBySymptom[symptom];

  if (duration === "more3days") {
    return {
      ...base,
      reason: `${base.reason} เนื่องจากอาการเป็นต่อเนื่องมากกว่า 3 วัน ควรให้แพทย์ตรวจบริบทก่อนเลือกแนวทางดูแล`
    };
  }

  return base;
}

export function isAssessmentSymptom(value: unknown): value is AssessmentSymptom {
  return typeof value === "string" && value in symptomLabels;
}

export function isAssessmentDuration(value: unknown): value is AssessmentDuration {
  return typeof value === "string" && value in durationLabels;
}
