import QRCode from "qrcode";
import { getAppEnv } from "@/lib/env/schema";

type PromptPayProxyType = "mobile" | "national_id" | "ewallet";

export type PromptPayInstruction = {
  payload: string | null;
  qrDataUrl: string | null;
  promptPayIdLabel: string;
  isConfigured: boolean;
};

function formatEmvField(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function getProxyType(promptPayId: string): PromptPayProxyType {
  const digits = promptPayId.replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("0")) {
    return "mobile";
  }

  if (digits.length === 13) {
    return "national_id";
  }

  return "ewallet";
}

function normalizePromptPayId(promptPayId: string): { fieldId: string; value: string } {
  const digits = promptPayId.replace(/\D/g, "");
  const proxyType = getProxyType(digits);

  if (proxyType === "mobile") {
    return {
      fieldId: "01",
      value: `0066${digits.slice(1)}`
    };
  }

  if (proxyType === "national_id") {
    return {
      fieldId: "02",
      value: digits
    };
  }

  return {
    fieldId: "03",
    value: digits
  };
}

function crc16CcittFalse(value: string): string {
  let crc = 0xffff;

  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

export function maskPromptPayId(promptPayId?: string): string {
  if (!promptPayId) {
    return "PromptPay ID not configured";
  }

  const digits = promptPayId.replace(/\D/g, "");

  if (digits.length <= 4) {
    return digits;
  }

  return `${digits.slice(0, 3)}${"*".repeat(Math.max(digits.length - 6, 3))}${digits.slice(-3)}`;
}

export function buildPromptPayPayload(promptPayId: string, amount: number): string {
  const normalized = normalizePromptPayId(promptPayId);
  const merchantAccountInfo = [
    formatEmvField("00", "A000000677010111"),
    formatEmvField(normalized.fieldId, normalized.value)
  ].join("");
  const payloadWithoutCrc = [
    formatEmvField("00", "01"),
    formatEmvField("01", "12"),
    formatEmvField("29", merchantAccountInfo),
    formatEmvField("53", "764"),
    formatEmvField("54", formatAmount(amount)),
    formatEmvField("58", "TH"),
    "6304"
  ].join("");

  return `${payloadWithoutCrc}${crc16CcittFalse(payloadWithoutCrc)}`;
}

export async function getPromptPayInstruction(amount: number): Promise<PromptPayInstruction> {
  const promptPayId = getAppEnv().THAI_QR_PROMPTPAY_ID;
  const promptPayIdLabel = maskPromptPayId(promptPayId);

  if (!promptPayId) {
    return {
      payload: null,
      qrDataUrl: null,
      promptPayIdLabel,
      isConfigured: false
    };
  }

  const payload = buildPromptPayPayload(promptPayId, amount);
  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 7
  });

  return {
    payload,
    qrDataUrl,
    promptPayIdLabel,
    isConfigured: true
  };
}

export async function getQrDataUrlFromPayload(payload: string | null): Promise<string | null> {
  if (!payload) {
    return null;
  }

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 6
  });
}
