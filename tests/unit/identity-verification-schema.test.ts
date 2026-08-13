import { describe, expect, it } from "vitest";
import {
  requestPhoneVerificationSchema,
  verifyPhoneVerificationSchema
} from "@/features/identity-verification/schema";

describe("progressive patient verification input", () => {
  it("accepts the minimum booking identity fields and a Thai mobile number", () => {
    expect(
      requestPhoneVerificationSchema.safeParse({
        fullName: "Ananya Example",
        dateOfBirth: "1990-01-30",
        phone: "+66 81 234 5678"
      }).success
    ).toBe(true);
  });

  it("rejects missing identity data, future dates, and malformed OTP codes", () => {
    expect(requestPhoneVerificationSchema.safeParse({ fullName: "", dateOfBirth: "2999-01-01", phone: "123" }).success).toBe(false);
    expect(verifyPhoneVerificationSchema.safeParse({ challengeId: "not-a-cuid", code: "12ab" }).success).toBe(false);
  });
});
