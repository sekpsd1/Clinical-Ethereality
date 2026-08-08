import { describe, expect, it } from "vitest";
import { submitPrescriptionSchema } from "@/features/doctor/consultations/schema";

describe("doctor structured prescription schema", () => {
  it("accepts a complete structured medication", () => {
    expect(
      submitPrescriptionSchema.safeParse({
        consultationId: "consultation-1",
        productId: "product-paracetamol",
        dosage: "500 mg",
        quantity: "10",
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
        productId: "product-paracetamol",
        dosage: "",
        quantity: "10",
        instructions: ""
      }).success
    ).toBe(false);
  });
});
