import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";

describe("customer consult service navigation", () => {
  it("shows Telemedicine as the section title and the revised service list in order", () => {
    const html = renderToStaticMarkup(
      <ConsultDoctorList
        data={{
          doctors: [],
          activeRecommendation: null
        }}
      />
    );

    const gynecologyIndex = html.indexOf("สูตินารีแพทย์");
    const screeningIndex = html.indexOf("HPV/STIs");
    const generalIndex = html.indexOf("ปรึกษาทั่วไป");

    expect(html).toContain(">Telemedicine</h1>");
    expect(gynecologyIndex).toBeGreaterThan(-1);
    expect(screeningIndex).toBeGreaterThan(gynecologyIndex);
    expect(generalIndex).toBeGreaterThan(screeningIndex);
    expect(html).not.toContain("ตรวจ HPV");
    expect(html).not.toContain("สูตินรีเวช");
    expect(html.match(/Telemedicine/g)).toHaveLength(1);
  });
});
