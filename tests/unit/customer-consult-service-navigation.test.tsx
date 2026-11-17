import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";

describe("customer consult service navigation", () => {
  it("shows Telemedicine with selectable gynecology and genetics categories", () => {
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
    expect(html).toContain('href="/consult?specialty=genetics"');
    expect(html).not.toContain("ตรวจ HPV");
    expect(html).not.toContain("สูตินรีเวช");
    expect(html.match(/Telemedicine/g)).toHaveLength(1);
  });
  it("defaults to all approved-list doctors and filters only explicit specialty aliases", () => {
    const doctors = ["สูตินรีเวชทั่วไป", "  พันธุศาสตร์  ", "พันธุศาสตร์คลินิก", "ปรึกษาทั่วไป", "พันธุศาสตร์อื่น"].map((specialty, index) => ({
      id: "fixture-" + index, name: "แพทย์ตัวอย่าง " + index, specialty,
      tags: [], price: "800 บาท / 15 นาที", rating: "4.9",
      imageSrc: "/images/doctors/kamonpat.jpg",
      bookingHref: ("/consult/assessment?doctorId=fixture-" + index) as import("next").Route,
      isRecommended: index === 2
    }));
    const data = { doctors, activeRecommendation: { topic: "หัวข้อเดิม", specialty: "คำแนะนำเดิม" } };
    const all = renderToStaticMarkup(<ConsultDoctorList data={data} />);
    expect(all.indexOf(">ทั้งหมด</a>")).toBeLessThan(all.indexOf(">สูตินรีแพทย์</a>"));
    expect(all.indexOf(">สูตินรีแพทย์</a>")).toBeLessThan(all.indexOf(">พันธุศาสตร์</a>"));
    expect(all).toMatch(/<a aria-current="page"[^>]+>ทั้งหมด<\/a>/);
    for (const doctor of doctors) {
      expect(all).toContain(doctor.name);
      expect(all).toContain(doctor.bookingHref);
    }

    const gynecology = renderToStaticMarkup(<ConsultDoctorList category="gynecology" data={data} />);
    expect(gynecology.match(/<article\b/g)).toHaveLength(1);
    expect(gynecology).toContain(doctors[0].name);
    expect(gynecology).toContain("ดูแพทย์ที่แนะนำในรายการ พันธุศาสตร์");

    const genetics = renderToStaticMarkup(<ConsultDoctorList category="genetics" data={data} />);
    expect(genetics.match(/<article\b/g)).toHaveLength(2);
    expect(genetics).toContain(doctors[1].bookingHref);
    expect(genetics).toContain(doctors[2].bookingHref);
    expect(genetics).toContain("แนะนำจากแบบประเมิน");
    expect(genetics).toMatch(/<a aria-current="page"[^>]+>พันธุศาสตร์<\/a>/);

    const empty = renderToStaticMarkup(<ConsultDoctorList category="genetics" data={{ ...data, doctors: [doctors[0]] }} />);
    expect(empty).toContain("ยังไม่มีแพทย์พร้อมให้บริการ ในหมวด พันธุศาสตร์");
  });
});
