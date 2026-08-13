import { getAppEnv } from "@/lib/env/schema";
import { getStorageReadiness } from "@/lib/storage/provider";
import { getSmsOtpReadiness } from "@/lib/sms/otp";

export type IntegrationReadinessItem = {
  label: string;
  status: "พร้อม" | "ยังไม่ครบ" | "ยังไม่ตั้งค่า";
  tone: "success" | "warning" | "danger";
  detail: string;
  configured: string[];
  missing: string[];
};

export type IntegrationReadinessData = {
  items: IntegrationReadinessItem[];
  summary: {
    ready: number;
    partial: number;
    missing: number;
    total: number;
  };
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function buildItem(label: string, detail: string, checks: Array<[string, boolean]>): IntegrationReadinessItem {
  const configured = checks.filter(([, ready]) => ready).map(([name]) => name);
  const missing = checks.filter(([, ready]) => !ready).map(([name]) => name);
  const status = missing.length === 0 ? "พร้อม" : configured.length > 0 ? "ยังไม่ครบ" : "ยังไม่ตั้งค่า";

  return {
    label,
    status,
    tone: status === "พร้อม" ? "success" : status === "ยังไม่ครบ" ? "warning" : "danger",
    detail,
    configured,
    missing
  };
}

export function getIntegrationReadiness(): IntegrationReadinessData {
  const env = getAppEnv();
  const isSlipOk = env.SLIP_VERIFICATION_PROVIDER === "slipok";
  const storageReadiness = getStorageReadiness(env);
  const smsOtpReadiness = getSmsOtpReadiness(env);

  const items = [
    buildItem(
      "SMS OTP",
      "ยืนยันการเข้าถึงเบอร์โทรของบัญชี LINE เท่านั้น ไม่ใช่การพิสูจน์ตัวตนตามเอกสาร",
      [
        ["SMS_OTP_PROVIDER", !smsOtpReadiness.missingKeys.includes("SMS_OTP_PROVIDER")],
        ["SMS_OTP_API_KEY", !smsOtpReadiness.missingKeys.includes("SMS_OTP_API_KEY")],
        ["SMS_OTP_API_SECRET", !smsOtpReadiness.missingKeys.includes("SMS_OTP_API_SECRET")]
      ]
    ),
    buildItem("PromptPay และ payment webhook", "ใช้สร้าง QR และรับ webhook/ตรวจสอบสถานะการชำระเงิน", [
      ["THAI_QR_PROMPTPAY_ID", hasValue(env.THAI_QR_PROMPTPAY_ID)],
      ["PAYMENT_WEBHOOK_SECRET", hasValue(env.PAYMENT_WEBHOOK_SECRET)]
    ]),
    buildItem("Slip verification", "รองรับ SlipOK/EasySlip โดยไม่แสดง API key ในหน้าแอดมิน", [
      ["SLIP_VERIFICATION_PROVIDER", hasValue(env.SLIP_VERIFICATION_PROVIDER)],
      ["SLIP_VERIFICATION_API_KEY", hasValue(env.SLIP_VERIFICATION_API_KEY)],
      ["SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME", isSlipOk || hasValue(env.SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME)],
      ["SLIPOK_BRANCH_ID", !isSlipOk || hasValue(env.SLIPOK_BRANCH_ID)]
    ]),
    buildItem("File storage", "ใช้เก็บ slip, prescription attachment, PDFs, images และไฟล์ clinical อื่น ๆ", [
      ["Cloudinary หรือ S3 credentials", storageReadiness.configuredKeys.length > 0],
      ["public/base URL", Boolean(storageReadiness.publicBaseUrl)]
    ]),
    buildItem("LINE LIFF", "ใช้เป็น customer entry path สำหรับ production LINE Mini App", [
      ["NEXT_PUBLIC_LINE_LIFF_ID", hasValue(env.NEXT_PUBLIC_LINE_LIFF_ID)],
      ["LINE_CHANNEL_ID", hasValue(env.LINE_CHANNEL_ID)],
      ["LINE_CHANNEL_SECRET", hasValue(env.LINE_CHANNEL_SECRET)],
      ["LINE_LOGIN_CALLBACK_URL", hasValue(env.LINE_LOGIN_CALLBACK_URL)]
    ]),
    buildItem("Zoom SDK", "ใช้สำหรับ video consultation เมื่อต้องต่อ production video room", [
      ["ZOOM_MEETING_SDK_CLIENT_ID", hasValue(env.ZOOM_MEETING_SDK_CLIENT_ID)],
      ["ZOOM_MEETING_SDK_CLIENT_SECRET", hasValue(env.ZOOM_MEETING_SDK_CLIENT_SECRET)],
      ["ZOOM_ACCOUNT_ID", hasValue(env.ZOOM_ACCOUNT_ID)],
      ["ZOOM_CLIENT_ID", hasValue(env.ZOOM_CLIENT_ID)],
      ["ZOOM_CLIENT_SECRET", hasValue(env.ZOOM_CLIENT_SECRET)],
      ["ZOOM_WEBHOOK_SECRET", hasValue(env.ZOOM_WEBHOOK_SECRET)]
    ])
  ];

  return {
    items,
    summary: {
      ready: items.filter((item) => item.status === "พร้อม").length,
      partial: items.filter((item) => item.status === "ยังไม่ครบ").length,
      missing: items.filter((item) => item.status === "ยังไม่ตั้งค่า").length,
      total: items.length
    }
  };
}
