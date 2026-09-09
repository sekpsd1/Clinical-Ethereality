import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import {
  assertTelemedicineSelfConsent,
  createTelemedicineConsent,
  TelemedicineConsentError
} from "@/features/consultations/consent/service";
import {
  getRecordingRetentionUntil,
  isAtLeast18,
  TELEMEDICINE_CONSENT_VERSION
} from "@/features/consultations/consent/policy";

describe("per-booking telemedicine consent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows adult self-consent only with the current version", () => {
    const now = new Date("2030-09-09T10:00:00.000Z");
    expect(isAtLeast18(new Date("2012-09-09T00:00:00.000Z"), now)).toBe(true);
    expect(() => assertTelemedicineSelfConsent({
      dateOfBirth: new Date("2012-09-09T00:00:00.000Z"),
      accepted: "on",
      version: TELEMEDICINE_CONSENT_VERSION,
      now
    })).not.toThrow();

    expect(() => assertTelemedicineSelfConsent({
      dateOfBirth: new Date("2012-09-09T00:00:00.000Z"),
      accepted: undefined,
      version: TELEMEDICINE_CONSENT_VERSION,
      now
    })).toThrowError(expect.objectContaining({ code: "REQUIRED" }));
    expect(() => assertTelemedicineSelfConsent({
      dateOfBirth: new Date("2012-09-09T00:00:00.000Z"),
      accepted: "on",
      version: "old-version",
      now
    })).toThrowError(expect.objectContaining({ code: "CURRENT_VERSION_REQUIRED" }));
  });

  it("blocks a minor from self-consenting even when the checkbox is forged", () => {
    expect(() => assertTelemedicineSelfConsent({
      dateOfBirth: new Date("2012-09-10T00:00:00.000Z"),
      accepted: "on",
      version: TELEMEDICINE_CONSENT_VERSION,
      now: new Date("2030-09-09T10:00:00.000Z")
    })).toThrowError(expect.objectContaining({ code: "GUARDIAN_REQUIRED" } satisfies Partial<TelemedicineConsentError>));
  });

  it("persists a new scoped record for each consultation with server-owned audit metadata", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ id: "consent-booking-1" })
      .mockResolvedValueOnce({ id: "consent-booking-2" });
    const tx = { telemedicineConsent: { create } } as never;
    const acceptedAt = new Date("2030-09-09T10:00:00.000Z");

    await createTelemedicineConsent(tx, {
      consultationId: "booking-1",
      userId: "customer-1",
      acceptedAt,
      ipAddress: "203.0.113.10",
      userAgent: "test-agent"
    });
    await createTelemedicineConsent(tx, {
      consultationId: "booking-2",
      userId: "customer-1",
      acceptedAt,
      ipAddress: null,
      userAgent: null
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map((call) => call[0].data.consultationId)).toEqual(["booking-1", "booking-2"]);
    expect(create.mock.calls[0][0].data).toMatchObject({
      version: TELEMEDICINE_CONSENT_VERSION,
      acceptedAt,
      metadataJson: {
        scope: ["audio", "video", "chat_history"],
        automaticRecording: true,
        retentionYears: 5,
        consentActor: "adult_patient"
      }
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(2);
  });

  it("calculates the five-year recording retention boundary", () => {
    expect(getRecordingRetentionUntil(new Date("2030-02-28T10:00:00.000Z")).toISOString())
      .toBe("2035-02-28T10:00:00.000Z");
  });
});
