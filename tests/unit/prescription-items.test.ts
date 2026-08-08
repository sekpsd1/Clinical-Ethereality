import { describe, expect, it } from "vitest";
import {
  formatPrescriptionItem,
  parsePrescriptionItems
} from "@/features/prescriptions/items";

describe("structured prescription items", () => {
  it("parses valid medication items and ignores incomplete values", () => {
    expect(
      parsePrescriptionItems([
        {
          medicationName: "Paracetamol",
          productId: "product-paracetamol",
          dosage: "500 mg",
          quantity: "10 tablets",
          instructions: "Take one tablet after meals",
          warnings: "Avoid duplicate paracetamol products"
        },
        {
          medicationName: "Incomplete"
        }
      ])
    ).toEqual([
      {
        medicationName: "Paracetamol",
        productId: "product-paracetamol",
        dosage: "500 mg",
        quantity: "10 tablets",
        instructions: "Take one tablet after meals",
        warnings: "Avoid duplicate paracetamol products"
      }
    ]);
  });

  it("formats a medication into a readable prescription summary", () => {
    expect(
      formatPrescriptionItem({
        medicationName: "Paracetamol",
        dosage: "500 mg",
        quantity: "10 tablets",
        instructions: "Take one tablet after meals"
      })
    ).toBe("Paracetamol • ขนาด 500 mg • จำนวน 10 tablets • Take one tablet after meals");
  });
});
