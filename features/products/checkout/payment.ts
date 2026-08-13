import { buildPromptPayPayload, isSupportedPromptPayId } from "@/lib/payments/promptpay";
import { getAppEnv } from "@/lib/env/schema";

export { isSupportedPromptPayId };

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
