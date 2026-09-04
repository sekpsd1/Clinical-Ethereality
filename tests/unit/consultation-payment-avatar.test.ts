import { describe, expect, it } from "vitest";
import { getPaymentDoctorAvatarUrl } from "@/features/consultations/payment/queries";

describe("consultation payment doctor avatar", () => {
  it.each([
    "/api/staff-files/websthai-profile",
    "https://cdn.example.test/websthai-profile.jpg"
  ])("keeps the current User.avatarUrl (%s)", (avatarUrl) => {
    expect(getPaymentDoctorAvatarUrl(avatarUrl)).toBe(avatarUrl);
  });

  it("uses the payment fallback only when the doctor has no avatar", () => {
    expect(getPaymentDoctorAvatarUrl(null)).toBe("/images/doctors/somchai-payment.png");
  });
});
