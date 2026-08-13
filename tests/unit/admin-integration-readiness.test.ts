import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAppEnv: vi.fn(),
  getSmsOtpReadiness: vi.fn(),
  getStorageReadiness: vi.fn()
}));

vi.mock("@/lib/env/schema", () => ({ getAppEnv: mocks.getAppEnv }));
vi.mock("@/lib/sms/otp", () => ({ getSmsOtpReadiness: mocks.getSmsOtpReadiness }));
vi.mock("@/lib/storage/provider", () => ({ getStorageReadiness: mocks.getStorageReadiness }));

import { getIntegrationReadiness } from "@/features/admin/integrations/readiness";

describe("provider-specific Admin payment readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSmsOtpReadiness.mockReturnValue({ missingKeys: [] });
    mocks.getStorageReadiness.mockReturnValue({ configuredKeys: [], publicBaseUrl: null });
  });

  it("does not require the EasySlip receiver-name setting when SlipOK Branch validation is configured", () => {
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "slipok",
      SLIP_VERIFICATION_API_KEY: "fixture-api-value",
      SLIPOK_BRANCH_ID: "fixture-branch-value"
    });

    const slipReadiness = getIntegrationReadiness().items.find(
      (item) => item.label === "Slip verification"
    );

    expect(slipReadiness?.status).toBe("พร้อม");
    expect(slipReadiness?.missing).not.toContain("SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME");
    expect(slipReadiness?.configured).toContain("SLIP_VERIFICATION_API_KEY");
    expect(JSON.stringify(slipReadiness)).not.toContain("fixture-api-value");
    expect(JSON.stringify(slipReadiness)).not.toContain("fixture-branch-value");
  });

  it("still requires an exact expected receiver for the inactive EasySlip adapter", () => {
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "easyslip",
      SLIP_VERIFICATION_API_KEY: "configured"
    });

    const slipReadiness = getIntegrationReadiness().items.find(
      (item) => item.label === "Slip verification"
    );

    expect(slipReadiness?.status).toBe("ยังไม่ครบ");
    expect(slipReadiness?.missing).toContain("SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME");
    expect(slipReadiness?.missing).not.toContain("SLIPOK_BRANCH_ID");
  });
});
