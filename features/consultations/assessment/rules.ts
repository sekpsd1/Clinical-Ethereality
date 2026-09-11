import type { AssessmentDuration, AssessmentRecommendation, AssessmentSymptom } from "@/features/consultations/assessment/types";

const clientDoctorSpecialty = "สูตินรีเวช และเวชศาสตร์มารดาและทารกในครรภ์";

export const symptomLabels: Record<AssessmentSymptom, string> = {
  rash_or_sore: "มีตุ่ม ผื่น หรือแผล",
  itching_or_redness: "คันหรือบวมแดง",
  urinary_symptoms: "ปัสสาวะผิดปกติ",
  other: "อื่นๆ โปรดระบุ"
};

export const durationLabels: Record<AssessmentDuration, string> = {
  less24h: "น้อยกว่า 24 ชม.",
  "1-3days": "1-3 วัน",
  more3days: "มากกว่า 3 วัน"
};

export function getAssessmentSymptomLabel(symptom: AssessmentSymptom, symptomDetail?: string): string {
  if (symptom === "other") {
    return `อื่นๆ: ${symptomDetail?.trim() ?? ""}`;
  }

  return symptomLabels[symptom];
}

const recommendationBySymptom: Record<AssessmentSymptom, AssessmentRecommendation> = {
  rash_or_sore: {
    topic: "ตุ่ม ผื่น หรือแผล",
    specialty: clientDoctorSpecialty,
    reason:
      "เราแนะนำให้เริ่มจากแพทย์เทเลเมดิซีนของคลินิกเพื่อประเมินลักษณะและความรุนแรงของอาการ ซักประวัติ และแนะนำแนวทางดูแลที่เหมาะสม"
  },
  itching_or_redness: {
    topic: "คันหรือบวมแดง",
    specialty: clientDoctorSpecialty,
    reason:
      "เราแนะนำให้เริ่มจากแพทย์เทเลเมดิซีนของคลินิกเพื่อประเมินอาการผิวหนังเบื้องต้น ตรวจประวัติร่วม และแนะนำแนวทางดูแลที่เหมาะสม"
  },
  urinary_symptoms: {
    topic: "ปัสสาวะผิดปกติ",
    specialty: clientDoctorSpecialty,
    reason:
      "เราแนะนำให้เริ่มจากแพทย์เทเลเมดิซีนของคลินิกเพื่อประเมินอาการเบื้องต้น และแนะนำว่าควรติดตามอาการหรือรับการตรวจเพิ่มเติมหรือไม่"
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
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(symptomLabels, value);
}

export function isAssessmentDuration(value: unknown): value is AssessmentDuration {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(durationLabels, value);
}
