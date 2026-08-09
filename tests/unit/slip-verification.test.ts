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
    status: 200,
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
  isAmountMatched?: boolean;
  isDuplicate?: boolean;
  matchedAccount?: unknown | null;
  receiverName?: string;
  status?: number;
  success?: boolean;
  errorCode?: string;
} = {}) {
  const amount = overrides.amount ?? 1200;
  const status = overrides.status ?? 200;
  const success = overrides.success ?? status === 200;

  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(
      success
        ? {
            success: true,
            data: {
              isDuplicate: overrides.isDuplicate ?? false,
              matchedAccount: overrides.matchedAccount === undefined ? { id: "registered-account" } : overrides.matchedAccount,
              amountInOrder: 1200,
              amountInSlip: amount,
              isAmountMatched: overrides.isAmountMatched ?? amount === 1200,
              rawSlip: {
                payload: "sensitive-qr-payload",
                transRef: "transaction-2",
                amount: {
                  amount
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
            }
          }
        : {
            success: false,
            error: {
              code: overrides.errorCode ?? "SLIP_NOT_FOUND",
              message: "provider error"
            }
          }
    )
  } as unknown as Response;
}

describe("slip verification fail-closed checks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "slipok",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIPOK_BRANCH_ID: "test-branch",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality",
      EASYSLIP_REQUEST_TIMEOUT_MS: 10_000
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

  it("does not call EasySlip when its API key is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "easyslip",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality"
    });

    await expect(
      verifyPaymentSlip({
        qrPayload: "slip-payload",
        amount: 1200
      })
    ).rejects.toThrow("SLIP_VERIFICATION_API_KEY");
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

  it("uses the documented EasySlip v2 request contract and accepts an exact matched response", async () => {
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "easyslip",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality",
      EASYSLIP_REQUEST_TIMEOUT_MS: 10_000
    });
    const fetchMock = vi.fn().mockResolvedValue(
      buildEasySlipResponse({
        receiverName: "Clinical Ethereality"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyPaymentSlip({
      qrPayload: "slip-payload",
      amount: 1200
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.easyslip.com/v2/verify/bank",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key"
        }),
        body: JSON.stringify({
          payload: "slip-payload",
          checkDuplicate: true,
          matchAccount: true,
          matchAmount: 1200
        })
      })
    );
    expect(result).toMatchObject({
      ok: true,
      status: "verified",
      transRef: "transaction-2",
      amount: 1200,
      receiverName: "Clinical Ethereality",
      raw: null
    });
  });

  it.each([
    ["receiver mismatch", { receiverName: "Another Merchant" }, "rejected"],
    ["amount mismatch", { amount: 1199, isAmountMatched: false, receiverName: "Clinical Ethereality" }, "rejected"],
    ["duplicate response", { isDuplicate: true, receiverName: "Clinical Ethereality" }, "rejected"],
    ["missing matched account", { matchedAccount: null }, "provider_error"],
    ["malformed successful response", { receiverName: undefined }, "provider_error"]
  ] as const)("fails closed for EasySlip %s", async (_label, overrides, expectedStatus) => {
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "easyslip",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality",
      EASYSLIP_REQUEST_TIMEOUT_MS: 10_000
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(buildEasySlipResponse(overrides)));

    const result = await verifyPaymentSlip({
      qrPayload: "slip-payload",
      amount: 1200
    });

    expect(result).toMatchObject({
      ok: false,
      status: expectedStatus
    });
  });

  it.each([
    ["HTTP 403 quota", buildEasySlipResponse({ status: 403, success: false, errorCode: "QUOTA_EXCEEDED" })],
    ["HTTP 429", buildEasySlipResponse({ status: 429, success: false, errorCode: "QUOTA_EXCEEDED" })],
    ["HTTP 5xx", buildEasySlipResponse({ status: 503, success: false, errorCode: "API_SERVER_ERROR" })]
  ])("keeps %s as pending/manual review provider error", async (_label, response) => {
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "easyslip",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality",
      EASYSLIP_REQUEST_TIMEOUT_MS: 10_000
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      verifyPaymentSlip({
        qrPayload: "slip-payload",
        amount: 1200
      })
    ).resolves.toMatchObject({
      ok: false,
      status: "provider_error"
    });
  });

  it("turns EasySlip network timeouts into provider errors without logging sensitive evidence", async () => {
    mocks.getAppEnv.mockReturnValue({
      SLIP_VERIFICATION_PROVIDER: "easyslip",
      SLIP_VERIFICATION_API_KEY: "test-api-key",
      SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: "Clinical Ethereality",
      EASYSLIP_REQUEST_TIMEOUT_MS: 1_000
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    const result = await verifyPaymentSlip({
      qrPayload: "sensitive-qr-payload",
      amount: 1200
    });

    expect(result).toEqual({
      ok: false,
      provider: "easyslip",
      status: "provider_error",
      transRef: null,
      amount: null,
      receiverName: null,
      raw: null
    });
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
