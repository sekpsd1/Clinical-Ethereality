import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readQueryFiles = [
  "features/consultations/appointment/queries.ts",
  "features/consultations/booking/queries.ts",
  "features/consultations/payment/queries.ts",
  "features/doctor/consultations/queries.ts"
] as const;

describe("consultation read paths", () => {
  it.each(readQueryFiles)("does not run expiry cleanup while rendering %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");

    expect(source).not.toContain("releaseExpiredConsultationSlotLocks");
  });

  it("retains expiry cleanup in authenticated booking and payment mutations", () => {
    const bookingAction = readFileSync(
      resolve(process.cwd(), "features/consultations/booking/actions.ts"),
      "utf8"
    );
    const paymentAction = readFileSync(
      resolve(process.cwd(), "features/consultations/payment/actions.ts"),
      "utf8"
    );

    expect(bookingAction).toContain("releaseExpiredConsultationSlotLocks");
    expect(paymentAction).toContain("releaseExpiredConsultationSlotLocks");
  });
});
