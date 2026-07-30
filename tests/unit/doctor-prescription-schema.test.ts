import { describe, expect, it } from "vitest";
import { submitPrescriptionSchema } from "@/features/doctor/consultations/schema";

describe("doctor structured prescription schema", () => {
  it("accepts a complete structured medication", () => {
    expect(
      submitPrescriptionSchema.safeParse({
        consultationId: "consultation-1",
        medicationName: "Paracetamol",
        dosage: "500 mg",
        quantity: "10 tablets",
        instructions: "Take one tablet after meals",
        warnings: "",
        notes: "Follow up if fever persists"
      }).success
    ).toBe(true);
  });

  it("rejects a prescription without dosage and instructions", () => {
    expect(
      submitPrescriptionSchema.safeParse({
        consultationId: "consultation-1",
        medicationName: "Paracetamol",
        dosage: "",
        quantity: "10 tablets",
        instructions: ""
      }).success
    ).toBe(false);
  });
});
