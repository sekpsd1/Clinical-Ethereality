import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultAssessmentIntro } from "@/features/consultations/ConsultAssessmentIntro";
import { CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION } from "@/features/consultations/assessment/consent";

describe("pre-consult health-data consent", () => {
  it("requires explicit consent and carries the selected doctor to symptom entry", () => {
    const doctorId = "ck12345678901234567890123";
    const html = renderToStaticMarkup(<ConsultAssessmentIntro doctorId={doctorId} />);

    expect(html).toContain('name="healthDataConsentAccepted"');
    expect(html).toContain("required");
    expect(html).toContain(`name="version" value="${CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION}"`);
    expect(html).toContain(`name="doctorId" value="${doctorId}"`);
    expect(html).toContain("24 ชั่วโมง");
    expect(html).toContain("ยินยอมและแจ้งอาการ");
  });
});
