import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAppEnv: vi.fn()
}));

vi.mock("@/lib/env/schema", () => ({
  getAppEnv: mocks.getAppEnv
}));

import { verifyPaymentSlip } from "@/lib/payments/slip-verification";

function buildSlipOkResponse(overrides: {
  amount?: number;
  receiverName?: string;
} = {}) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      success: true,
      data: {
        success: true,
        transRef: "transaction-1",
        amount: overrides.amount ?? 1200,
        receiver: overrides.receiverName
          ? {
              displayName: overrides.receiverName
            }
          : undefined
      }
    })
  } as unknown as Response;
}

function buildEasySlipResponse(overrides: {
  amount?: number;
  receiverName?: string;
} = {}) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      success: true,
      data: {
        transRef: "transaction-2",
        amount: {
          amount: overrides.amount ?? 1200
        },
        receiver: overrides.receiverName
          ? {
              account: {
                name: {
                  th: overrides.receiverName
                }
              }
            }
          : undefined
      }
    })
  } as unknown as Response;
}

describe("slip verification fail-closed checks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "slipok",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIPOK_BRANCH_ID: "test-branch",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality"
    });
  });

  it("does not call a provider when the expected receiver is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "slipok",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIPOK_BRANCH_ID: "test-branch"
    });

    await expect(
      verifyPaymentSlip({
        qrPayload: "slip-payload",
        amount: 1200
      })
    ).rejects.toThrow("SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed as a provider error when a successful SlipOK response omits the receiver", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(buildSlipOkResponse()));

    const result = await verifyPaymentSlip({
      qrPayload: "slip-payload",
      amount: 1200
    });

    expect(result).toMatchObject({
      ok: false,
      status: "provider_error",
      receiverName: null
    });
  });

  it("rejects a successful SlipOK response when the returned amount differs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSlipOkResponse({
          amount: 1199,
          receiverName: "Clinical Ethereality"
        })
      )
    );

    const result = await verifyPaymentSlip({
      qrPayload: "slip-payload",
      amount: 1200
    });

    expect(result).toMatchObject({
      ok: false,
      status: "rejected",
      amount: 1199
    });
  });

  it("verifies only when SlipOK returns the expected receiver and amount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSlipOkResponse({
          amount: 1200,
          receiverName: "Clinical Ethereality"
        })
      )
    );

    const result = await verifyPaymentSlip({
      qrPayload: "slip-payload",
      amount: 1200
    });

    expect(result).toMatchObject({
      ok: true,
      status: "verified",
      transRef: "transaction-1"
    });
  });

  it("rejects a receiver that only contains the configured merchant name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSlipOkResponse({
          amount: 1200,
          receiverName: "Clinical Ethereality Clinic"
        })
      )
    );

    const result = await verifyPaymentSlip({
      qrPayload: "slip-payload",
      amount: 1200
    });

    expect(result).toMatchObject({
      ok: false,
      status: "rejected",
      receiverName: "Clinical Ethereality Clinic"
    });
  });

  it("fails closed when EasySlip omits required receiver data", async () => {
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "easyslip",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality"
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(buildEasySlipResponse()));

    const result = await verifyPaymentSlip({
      imageUrl: "https://storage.example/slip.jpg",
      amount: 1200
    });

    expect(result).toMatchObject({
      ok: false,
      status: "provider_error",
      receiverName: null
    });
  });

  it("rejects EasySlip when the returned receiver does not match", async () => {
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "easyslip",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildEasySlipResponse({
          receiverName: "Another Merchant"
        })
      )
    );

    const result = await verifyPaymentSlip({
      imageUrl: "https://storage.example/slip.jpg",
      amount: 1200
    });

    expect(result).toMatchObject({
      ok: false,
      status: "rejected",
      receiverName: "Another Merchant"
    });
  });
});
