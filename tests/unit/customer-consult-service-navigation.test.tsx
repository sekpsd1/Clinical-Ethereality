import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";

describe("customer consult service navigation", () => {
  it("shows Telemedicine with only the correctly spelled gynecology category", () => {
    const html = renderToStaticMarkup(
      <ConsultDoctorList
        data={{
          doctors: [],
          activeRecommendation: null
        }}
      />
    );

    expect(html).toContain(">Telemedicine</h1>");
    expect(html).toContain("สูตินรีแพทย์");
    expect(html).not.toContain("สูตินารีแพทย์");
    expect(html).not.toContain("HPV/STIs");
    expect(html).not.toContain("ปรึกษาทั่วไป");
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).not.toContain("ตรวจ HPV");
    expect(html).not.toContain("สูตินรีเวช");
    expect(html.match(/Telemedicine/g)).toHaveLength(1);
  });
  it("does not filter doctor cards, prices, recommendations or booking routes by the category label", () => {
    const doctors = ["สูตินรีเวช", "HPV/STIs", "ปรึกษาทั่วไป"].map((specialty, index) => ({
      id: `fixture-${index}`, name: `แพทย์ตัวอย่าง ${index}`, specialty,
      tags: ["#Telemedicine"], price: `${1000 + index} บาท / 15 นาที`, rating: "4.9",
      imageSrc: "/images/doctors/kamonpat.jpg",
      bookingHref: `/consult/assessment?doctorId=fixture-${index}` as const,
      isRecommended: index === 1
    }));
    const html = renderToStaticMarkup(<ConsultDoctorList data={{
      doctors, activeRecommendation: { topic: "หัวข้อเดิม", specialty: "คำแนะนำเดิม" }
    }} />);
    expect(html.match(/<article\b/g)).toHaveLength(3);
    expect(html.match(/<button\b/g)).toHaveLength(1);
    for (const doctor of doctors) {
      expect(html).toContain(doctor.name);
      expect(html).toContain(doctor.specialty);
      expect(html).toContain(doctor.price);
      expect(html).toContain(`href="${doctor.bookingHref}"`);
    }
    expect(html).toContain("แนะนำจากแบบประเมิน");
    expect(html).toContain("หัวข้อเดิม");
    expect(html).toContain("คำแนะนำเดิม");
  });
});
