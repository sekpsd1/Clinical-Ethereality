import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAppEnv } from "@/lib/env/schema";
import {
  paymentSlipMaxBytes,
  paymentSlipMimeTypes,
  type PaymentSlipMimeType
} from "@/features/payments/private-slip-policy";

const extensionByMimeType: Record<PaymentSlipMimeType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

export const paymentSlipEntityType = "payment_slip";

export class PaymentSlipError extends Error {
  constructor(
    public readonly code:
      | "FILE_EMPTY"
      | "FILE_CONTENT_INVALID"
      | "FILE_TOO_LARGE"
      | "FILE_TYPE_NOT_ALLOWED"
      | "STORAGE_NOT_CONFIGURED"
      | "STORAGE_WRITE_FAILED"
  ) {
    super(code);
  }
}

export type PreparedPrivatePaymentSlip = {
  attachmentId: string;
  byteSize: number;
  cleanup: () => Promise<void>;
  fileName: string;
  mimeType: PaymentSlipMimeType;
  storageKey: string;
  storageUrl: string;
};

function getUploadRoot(): string {
  const configuredRoot = getAppEnv().PAYMENT_UPLOAD_DIR?.trim();

  if (configuredRoot) {
    const resolvedRoot = path.resolve(configuredRoot);
    const applicationRoot = path.resolve(process.cwd());
    const isInsideApplication =
      resolvedRoot === applicationRoot || resolvedRoot.startsWith(`${applicationRoot}${path.sep}`);

    if (!path.isAbsolute(configuredRoot) || (process.env.NODE_ENV === "production" && isInsideApplication)) {
      throw new PaymentSlipError("STORAGE_NOT_CONFIGURED");
    }

    return resolvedRoot;
  }

  if (process.env.NODE_ENV === "production") {
    throw new PaymentSlipError("STORAGE_NOT_CONFIGURED");
  }

  return path.resolve(process.cwd(), ".local-uploads", "payments");
}

function ownerDirectory(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 24);
}

function paymentDirectory(paymentId: string): string {
  return createHash("sha256").update(paymentId).digest("hex").slice(0, 24);
}

function toStorageKey(ownerId: string, paymentId: string, attachmentId: string, extension: string): string {
  return path.posix.join("payments", ownerDirectory(ownerId), paymentDirectory(paymentId), `${attachmentId}${extension}`);
}

function sanitizeFileName(fileName: string): string {
  const normalized = path.basename(fileName).replace(/[\u0000-\u001f\\/]/g, "_").trim();
  return (normalized || "payment-slip").slice(0, 255);
}

export function resolvePaymentSlipPath(storageKey: string): string {
  const root = getUploadRoot();
  const resolved = path.resolve(root, ...storageKey.split("/"));

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new PaymentSlipError("STORAGE_WRITE_FAILED");
  }

  return resolved;
}

export async function readPrivatePaymentSlip(storageKey: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(resolvePaymentSlipPath(storageKey)));
}

export function validatePaymentSlipUpload(file: File): { extension: string; mimeType: PaymentSlipMimeType } {
  if (!file || file.size === 0) {
    throw new PaymentSlipError("FILE_EMPTY");
  }

  if (file.size > paymentSlipMaxBytes) {
    throw new PaymentSlipError("FILE_TOO_LARGE");
  }

  if (!paymentSlipMimeTypes.includes(file.type as PaymentSlipMimeType)) {
    throw new PaymentSlipError("FILE_TYPE_NOT_ALLOWED");
  }

  const mimeType = file.type as PaymentSlipMimeType;
  return { extension: extensionByMimeType[mimeType], mimeType };
}

export function validatePaymentSlipContent(mimeType: PaymentSlipMimeType, bytes: Uint8Array): void {
  const isValid =
    (mimeType === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (mimeType === "image/png" &&
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) ||
    (mimeType === "image/webp" &&
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP");

  if (!isValid) {
    throw new PaymentSlipError("FILE_CONTENT_INVALID");
  }
}

export async function preparePrivatePaymentSlip(input: {
  file: File;
  ownerId: string;
  paymentId: string;
}): Promise<PreparedPrivatePaymentSlip> {
  const { extension, mimeType } = validatePaymentSlipUpload(input.file);
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  validatePaymentSlipContent(mimeType, bytes);

  const attachmentId = randomUUID();
  const storageKey = toStorageKey(input.ownerId, input.paymentId, attachmentId, extension);
  const filePath = resolvePaymentSlipPath(storageKey);

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes, { flag: "wx" });
  } catch {
    throw new PaymentSlipError("STORAGE_WRITE_FAILED");
  }

  return {
    attachmentId,
    byteSize: bytes.byteLength,
    cleanup: () => unlink(filePath).catch(() => undefined),
    fileName: sanitizeFileName(input.file.name),
    mimeType,
    storageKey,
    storageUrl: `/api/payments/slips/${attachmentId}`
  };
}

export function getPaymentSlipErrorMessage(error: unknown): string {
  if (!(error instanceof PaymentSlipError)) {
    return "ไม่สามารถบันทึกสลิปได้ กรุณาลองใหม่";
  }

  const messages: Record<PaymentSlipError["code"], string> = {
    FILE_EMPTY: "กรุณาเลือกไฟล์รูปสลิป",
    FILE_CONTENT_INVALID: "ไฟล์รูปสลิปไม่ตรงกับชนิดไฟล์ที่ระบุ",
    FILE_TOO_LARGE: "รูปสลิปมีขนาดเกิน 5 MB",
    FILE_TYPE_NOT_ALLOWED: "รองรับเฉพาะรูป JPG, PNG หรือ WebP",
    STORAGE_NOT_CONFIGURED: "ยังไม่ได้ตั้งค่า PAYMENT_UPLOAD_DIR สำหรับพื้นที่เก็บสลิปส่วนตัว",
    STORAGE_WRITE_FAILED: "ยังบันทึกสลิปลงพื้นที่เก็บข้อมูลไม่ได้ กรุณาลองใหม่"
  };

  return messages[error.code];
}
