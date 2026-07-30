import { describe, expect, it } from "vitest";
import { hasExactlyOnePaymentEvidence } from "@/features/payments/evidence";

describe("payment evidence", () => {
  it.each([
    [{ qrPayload: "qr-data" }, true],
    [{ imageUrl: "https://cdn.example.com/slip.png" }, true],
    [{ qrPayload: "qr-data", imageUrl: "https://cdn.example.com/slip.png" }, false],
    [{ qrPayload: "   ", imageUrl: "   " }, false]
  ] as const)("accepts exactly one evidence source for %o", (input, expected) => {
    expect(hasExactlyOnePaymentEvidence(input)).toBe(expected);
  });
});
