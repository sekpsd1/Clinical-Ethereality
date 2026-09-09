import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ContactPage from "@/app/contact/page";
import PrivacyPolicyPage from "@/app/privacy-policy/page";
import TelemedicineConsentPage from "@/app/telemedicine-consent/page";

describe("public legal and contact pages", () => {
  it("publishes the approved controller and contact details without an auth wrapper", () => {
    const html = renderToStaticMarkup(<ContactPage />);
    expect(html).toContain("บางกอกไซโตเจเนติกซ์คลินิกเฉพาะทางด้านเวชกรรมสูตินรีเวช");
    expect(html).toContain("65/18 ซอยโชคชัยร่วมมิตร");
    expect(html).toContain("info@bccgroup-thailand.com");
    expect(html).toContain("02-690-0063");
    expect(html).toContain("086-306-2084");
  });

  it("states withdrawal consequences and five-year retention", () => {
    const privacyHtml = renderToStaticMarkup(<PrivacyPolicyPage />);
    expect(privacyHtml).toContain("มีผลต่อการประมวลผลในอนาคต");
    expect(privacyHtml).toContain("ไม่กระทบความชอบด้วยกฎหมายของการประมวลผลก่อนถอน");
    expect(privacyHtml).toContain("เก็บรักษา 5 ปี");
  });

  it("states per-booking automatic recording and the under-18 boundary", () => {
    const html = renderToStaticMarkup(<TelemedicineConsentPage />);
    expect(html).toContain("บันทึกเสียง วิดีโอ และประวัติแชทโดยอัตโนมัติทุกเคส");
    expect(html).toContain("ความยินยอมจากการจองเก่ามาใช้แทน");
    expect(html).toContain("ผู้มีอายุต่ำกว่า 18 ปีห้ามให้ความยินยอมด้วยตนเอง");
  });
});
