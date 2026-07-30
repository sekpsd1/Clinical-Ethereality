import { buildPromptPayPayload } from "@/lib/payments/promptpay";
import { getAppEnv } from "@/lib/env/schema";

export function isSupportedPromptPayId(promptPayId: string | undefined): boolean {
  const digits = promptPayId?.replace(/\D/g, "") ?? "";

  return (
    (digits.length === 10 && digits.startsWith("0")) ||
    digits.length === 13 ||
    digits.length === 15
  );
}

export function isStorePromptPayReady(
  promptPayId = getAppEnv().THAI_QR_PROMPTPAY_ID
): boolean {
  return isSupportedPromptPayId(promptPayId);
}

export function createStorePromptPayPayload(
  amount: number,
  promptPayId = getAppEnv().THAI_QR_PROMPTPAY_ID
): string | null {
  if (!promptPayId || !isSupportedPromptPayId(promptPayId) || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  try {
    const payload = buildPromptPayPayload(promptPayId, amount);
    return payload.trim().length > 0 ? payload : null;
  } catch {
    return null;
  }
}
