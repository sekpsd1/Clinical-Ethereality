import { describe, expect, it } from "vitest";
import {
  buildPromptPayPayload,
  getPromptPayInstruction,
  isSupportedPromptPayId,
  maskPromptPayId
} from "@/lib/payments/promptpay";

describe("PromptPay runtime configuration", () => {
  it.each(["0812345678", "1-2345-67890-12-3", "123456789012345"])(
    "accepts a supported proxy without exposing it: %s",
    (promptPayId) => {
      expect(isSupportedPromptPayId(promptPayId)).toBe(true);
      expect(maskPromptPayId(promptPayId)).not.toBe(promptPayId.replace(/\D/g, ""));
      expect(buildPromptPayPayload(promptPayId, 100)).toMatch(/^000201/);
    }
  );

  it.each([undefined, "", "1234", "not-a-proxy"])("fails closed for %s", (promptPayId) => {
    expect(isSupportedPromptPayId(promptPayId)).toBe(false);
    if (promptPayId) {
      expect(() => buildPromptPayPayload(promptPayId, 100)).toThrow();
    }
  });

  it("does not generate a consultation QR from an unsupported environment value", async () => {
    const previous = process.env.THAI_QR_PROMPTPAY_ID;
    process.env.THAI_QR_PROMPTPAY_ID = "unsupported";

    try {
      await expect(getPromptPayInstruction(100)).resolves.toMatchObject({
        payload: null,
        qrDataUrl: null,
        isConfigured: false
      });
    } finally {
      if (previous === undefined) {
        delete process.env.THAI_QR_PROMPTPAY_ID;
      } else {
        process.env.THAI_QR_PROMPTPAY_ID = previous;
      }
    }
  });

  it("exposes the configured full PromptPay ID and account name for the customer payment instruction", async () => {
    const previousId = process.env.THAI_QR_PROMPTPAY_ID;
    const previousName = process.env.THAI_QR_PROMPTPAY_ACCOUNT_NAME;
    process.env.THAI_QR_PROMPTPAY_ID = "1-2345-67890-12-3";
    process.env.THAI_QR_PROMPTPAY_ACCOUNT_NAME = "บจก.มีเดีย ดีไซน์";

    try {
      await expect(getPromptPayInstruction(1)).resolves.toMatchObject({
        accountName: "บจก.มีเดีย ดีไซน์",
        isConfigured: true,
        promptPayIdLabel: "1234567890123"
      });
    } finally {
      if (previousId === undefined) {
        delete process.env.THAI_QR_PROMPTPAY_ID;
      } else {
        process.env.THAI_QR_PROMPTPAY_ID = previousId;
      }

      if (previousName === undefined) {
        delete process.env.THAI_QR_PROMPTPAY_ACCOUNT_NAME;
      } else {
        process.env.THAI_QR_PROMPTPAY_ACCOUNT_NAME = previousName;
      }
    }
  });
});
