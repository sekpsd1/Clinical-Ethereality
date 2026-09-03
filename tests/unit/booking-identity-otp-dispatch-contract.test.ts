import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

describe("booking identity OTP dispatch contract", () => {
  it("keeps one explicit fetch path behind a non-submit button inside the parent form", () => {
    const identitySource = readSource("features/identity-verification/BookingIdentityVerification.tsx");
    const bookingSource = readSource("features/consultations/booking/BookingTimeSlotForm.tsx");

    expect(identitySource.match(/\bfetch\(/g)).toHaveLength(1);
    expect(identitySource).toContain('<button type="button" disabled={pending} onClick={requestOtp}');
    expect(identitySource).toContain('disabled={pending || !resendReady} onClick={resendOtp}');
    expect(identitySource).toContain('setTimeout(() => {');
    expect(identitySource).not.toContain("useEffect");
    expect(identitySource).not.toContain("<form");
    expect(bookingSource).toContain('<form action={createConsultationBookingAction}');
    expect(bookingSource.match(/<BookingIdentityVerification\b/g)).toHaveLength(1);
  });

  it("retains the successful request latch before committing OTP-entry state", () => {
    const source = readSource("features/identity-verification/BookingIdentityVerification.tsx");
    const challengeStateIndex = source.indexOf("setChallengeId(result.challengeId ?? null)");
    const retainedSuccessIndex = source.indexOf("retainWhen: (result) => result?.ok === true");

    expect(challengeStateIndex).toBeGreaterThan(0);
    expect(retainedSuccessIndex).toBeGreaterThan(challengeStateIndex);
    expect(source).toContain("resetCompletedSingleFlight(requestInFlight)");
    expect(source).toContain("async function resendOtp()");
    expect(source).toContain("startResendCooldown()");
  });
});
