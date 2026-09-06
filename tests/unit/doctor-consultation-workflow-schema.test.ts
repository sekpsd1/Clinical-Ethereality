import { describe, expect, it } from "vitest";
import { transitionDoctorConsultationSchema } from "@/features/doctor/consultations/workflow-schema";

describe("doctor consultation completion schema", () => {
  it("requires a clinical summary only for normal completion", () => {
    expect(
      transitionDoctorConsultationSchema.safeParse({
        consultationId: "consultation-1",
        transition: "complete",
        summary: ""
      }).success
    ).toBe(false);
    expect(
      transitionDoctorConsultationSchema.safeParse({
        consultationId: "consultation-1",
        transition: "complete",
        summary: "คำแนะนำครบถ้วน"
      }).success
    ).toBe(true);
  });

  it("accepts only the controlled no-show reason and rejects clinical advice", () => {
    expect(
      transitionDoctorConsultationSchema.safeParse({
        consultationId: "consultation-1",
        transition: "complete_no_show",
        noShowReason: "customer_did_not_join"
      }).success
    ).toBe(true);
    expect(
      transitionDoctorConsultationSchema.safeParse({
        consultationId: "consultation-1",
        transition: "complete_no_show",
        noShowReason: "other"
      }).success
    ).toBe(false);
    expect(
      transitionDoctorConsultationSchema.safeParse({
        consultationId: "consultation-1",
        transition: "complete_no_show",
        noShowReason: "customer_did_not_join",
        summary: "patient attended"
      }).success
    ).toBe(false);
  });
});
