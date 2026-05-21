import type { AssessmentDuration, AssessmentRecommendation, AssessmentSymptom } from "@/features/consultations/assessment/types";

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
    specialty: "อายุรกรรม",
    reason: "เหมาะกับแพทย์ที่ประเมินอาการทั่วไปและแยกสาเหตุเบื้องต้นได้"
  },
  fever: {
    topic: "ไข้หรือหนาวสั่น",
    specialty: "อายุรกรรม",
    reason: "เหมาะกับแพทย์ที่ประเมินอาการติดเชื้อและความรุนแรงเบื้องต้น"
  },
  cough: {
    topic: "ไอหรือเจ็บคอ",
    specialty: "อายุรกรรม",
    reason: "เหมาะกับแพทย์ที่ประเมินอาการระบบทางเดินหายใจเบื้องต้น"
  },
  other: {
    topic: "อาการอื่นๆ",
    specialty: "ปรึกษาทั่วไป",
    reason: "เหมาะกับแพทย์ที่ช่วยคัดกรองและแนะนำแนวทางต่อเนื่อง"
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
