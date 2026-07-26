export const doctorSpecialtyChoices = [
  { value: "family_medicine", label: "เวชศาสตร์ครอบครัว" },
  { value: "internal_medicine", label: "อายุรศาสตร์" },
  { value: "obstetrics_gynecology", label: "สูติศาสตร์และนรีเวชวิทยา" },
  { value: "maternal_fetal_medicine", label: "เวชศาสตร์มารดาและทารกในครรภ์" },
  { value: "dermatology_aesthetics", label: "ผิวหนังและความงาม" },
  { value: "plastic_surgery", label: "ศัลยศาสตร์ตกแต่ง" },
  { value: "anti_aging_medicine", label: "เวชศาสตร์ชะลอวัยและฟื้นฟูสุขภาพ" },
  { value: "other", label: "อื่น ๆ" }
] as const;

export const doctorSpecialtyValues = doctorSpecialtyChoices.map((choice) => choice.value) as [
  (typeof doctorSpecialtyChoices)[number]["value"],
  ...(typeof doctorSpecialtyChoices)[number]["value"][]
];

export type DoctorSpecialtyValue = (typeof doctorSpecialtyChoices)[number]["value"];

const doctorSpecialtyLabels = Object.fromEntries(
  doctorSpecialtyChoices.map((choice) => [choice.value, choice.label])
) as Record<DoctorSpecialtyValue, string>;

export function formatDoctorSpecialties(values: DoctorSpecialtyValue[], otherSpecialty?: string): string {
  const labels = values
    .filter((value) => value !== "other")
    .map((value) => doctorSpecialtyLabels[value]);
  const normalizedOther = otherSpecialty?.trim();

  if (values.includes("other") && normalizedOther) {
    labels.push(normalizedOther);
  }

  return Array.from(new Set(labels)).join(", ");
}
