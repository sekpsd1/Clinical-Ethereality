import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { getAppEnv } from "@/lib/env/schema";
import { normalizeThaiMobileNumber } from "@/lib/identity/thai-phone";
import { prisma } from "@/lib/db/prisma";
import { getSmsOtpReadiness, requestSmsOtp, SmsOtpError, verifySmsOtp } from "@/lib/sms/otp";
import type { RequestPhoneVerificationInput } from "@/features/identity-verification/schema";

const otpTtlMs = 10 * 60 * 1000;
const resendDelayMs = 60 * 1000;
const requestWindowMs = 60 * 60 * 1000;
const maxRequestsPerWindow = 3;
const maxAttempts = 5;

export type PatientVerificationStatus = {
  fullName: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  isVerified: boolean;
};

export class PatientVerificationError extends Error {
  constructor(
    public readonly code:
      | "CONFIGURATION_ERROR"
      | "PROFILE_REQUIRED"
      | "PHONE_IN_USE"
      | "RATE_LIMITED"
      | "CHALLENGE_NOT_FOUND"
      | "CHALLENGE_EXPIRED"
      | "ATTEMPTS_EXHAUSTED"
      | "CHALLENGE_INVALIDATED"
      | "OTP_REJECTED"
      | "OTP_UNAVAILABLE"
  ) {
    super(code);
    this.name = "PatientVerificationError";
  }
}

function getChallengeCipherKey(): Buffer {
  const secret = getAppEnv().SMS_OTP_CHALLENGE_ENCRYPTION_KEY;

  if (!secret || secret.trim().length < 32) {
    throw new PatientVerificationError("CONFIGURATION_ERROR");
  }

  return createHash("sha256").update(secret).digest();
}

function encryptProviderChallenge(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getChallengeCipherKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptProviderChallenge(value: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new PatientVerificationError("CHALLENGE_INVALIDATED");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", getChallengeCipherKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof PatientVerificationError) {
      throw error;
    }
    throw new PatientVerificationError("CHALLENGE_INVALIDATED");
  }
}

function mapOtpError(error: unknown): PatientVerificationError {
  if (error instanceof SmsOtpError) {
    if (error.code === "CONFIGURATION_ERROR") return new PatientVerificationError("CONFIGURATION_ERROR");
    if (error.code === "PROVIDER_UNAVAILABLE") return new PatientVerificationError("OTP_UNAVAILABLE");
  }

  return new PatientVerificationError("OTP_REJECTED");
}

function toDateOfBirth(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toStatus(user: {
  fullName: string | null;
  dateOfBirth: Date | null;
  phone: string | null;
  normalizedPhone: string | null;
  phoneVerifiedAt: Date | null;
} | null): PatientVerificationStatus {
  const isVerified = Boolean(user?.fullName && user.dateOfBirth && user.phone && user.normalizedPhone && user.phoneVerifiedAt);

  return {
    fullName: user?.fullName ?? null,
    dateOfBirth: user?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    phone: user?.phone ?? null,
    phoneVerifiedAt: user?.phoneVerifiedAt?.toISOString() ?? null,
    isVerified
  };
}

export async function getPatientVerificationStatus(userId: string): Promise<PatientVerificationStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      dateOfBirth: true,
      phone: true,
      normalizedPhone: true,
      phoneVerifiedAt: true
    }
  });

  return toStatus(user);
}

export async function requireVerifiedPatientProfile(userId: string): Promise<void> {
  const status = await getPatientVerificationStatus(userId);
  if (!status.isVerified) {
    throw new PatientVerificationError("PROFILE_REQUIRED");
  }
}

export async function requestPatientPhoneVerification(
  userId: string,
  input: RequestPhoneVerificationInput
): Promise<{ challengeId: string; phoneLabel: string; expiresAt: string } | { alreadyVerified: true }> {
  const env = getAppEnv();
  if (!getSmsOtpReadiness(env).isConfigured || !env.SMS_OTP_CHALLENGE_ENCRYPTION_KEY) {
    throw new PatientVerificationError("CONFIGURATION_ERROR");
  }

  const normalizedPhone = normalizeThaiMobileNumber(input.phone);
  const dateOfBirth = toDateOfBirth(input.dateOfBirth);
  const now = new Date();
  const [user, existingPhoneOwner] = await Promise.all([
    prisma.user.findUnique({
    where: { id: userId },
    select: { normalizedPhone: true, phoneVerifiedAt: true }
    }),
    prisma.user.findFirst({
      where: { normalizedPhone: normalizedPhone.e164, id: { not: userId } },
      select: { id: true }
    })
  ]);

  if (!user) {
    throw new PatientVerificationError("PROFILE_REQUIRED");
  }
  if (existingPhoneOwner) {
    throw new PatientVerificationError("PHONE_IN_USE");
  }

  if (user.normalizedPhone === normalizedPhone.e164 && user.phoneVerifiedAt) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { fullName: input.fullName, dateOfBirth, phone: normalizedPhone.local }
      });
      await writeAuditLog(tx, {
        actorId: userId,
        action: "patient_verification.profile.update",
        entityType: "user",
        entityId: userId,
        metadata: { phoneVerificationReused: true }
      });
    });
    return { alreadyVerified: true };
  }

  const [recentChallenge, requestCount] = await Promise.all([
    prisma.phoneVerificationChallenge.findFirst({
      where: { userId },
      orderBy: { requestedAt: "desc" },
      select: { requestedAt: true }
    }),
    prisma.phoneVerificationChallenge.count({
      where: { userId, requestedAt: { gte: new Date(now.getTime() - requestWindowMs) } }
    })
  ]);

  if (recentChallenge && now.getTime() - recentChallenge.requestedAt.getTime() < resendDelayMs) {
    throw new PatientVerificationError("RATE_LIMITED");
  }
  if (requestCount >= maxRequestsPerWindow) {
    throw new PatientVerificationError("RATE_LIMITED");
  }

  let providerChallenge;
  try {
    providerChallenge = await requestSmsOtp(normalizedPhone.local, { env });
  } catch (error) {
    throw mapOtpError(error);
  }

  const expiresAt = new Date(now.getTime() + otpTtlMs);
  const challenge = await prisma.$transaction(async (tx) => {
    await tx.phoneVerificationChallenge.updateMany({
      where: { userId, verifiedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now }
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        dateOfBirth,
        phone: normalizedPhone.local,
        normalizedPhone: normalizedPhone.e164,
        phoneVerifiedAt: null
      }
    });
    const created = await tx.phoneVerificationChallenge.create({
      data: {
        userId,
        normalizedPhone: normalizedPhone.e164,
        providerChallengeCiphertext: encryptProviderChallenge(providerChallenge.providerChallengeId),
        expiresAt,
        requestedAt: now
      },
      select: { id: true }
    });
    await writeAuditLog(tx, {
      actorId: userId,
      action: "patient_verification.otp.request",
      entityType: "user",
      entityId: userId,
      metadata: { provider: providerChallenge.provider, phoneChanged: user.normalizedPhone !== normalizedPhone.e164 }
    });
    return created;
  });

  return { challengeId: challenge.id, phoneLabel: providerChallenge.phoneLabel, expiresAt: expiresAt.toISOString() };
}

export async function verifyPatientPhoneVerification(userId: string, challengeId: string, code: string): Promise<void> {
  const now = new Date();
  const challenge = await prisma.phoneVerificationChallenge.findFirst({
    where: { id: challengeId, userId, verifiedAt: null },
    select: { id: true, normalizedPhone: true, providerChallengeCiphertext: true, expiresAt: true, attemptCount: true }
  });

  if (!challenge) throw new PatientVerificationError("CHALLENGE_NOT_FOUND");
  if (challenge.expiresAt <= now) throw new PatientVerificationError("CHALLENGE_EXPIRED");
  if (challenge.attemptCount >= maxAttempts) throw new PatientVerificationError("ATTEMPTS_EXHAUSTED");

  const claimed = await prisma.phoneVerificationChallenge.updateMany({
    where: { id: challenge.id, userId, verifiedAt: null, expiresAt: { gt: now }, attemptCount: { lt: maxAttempts } },
    data: { attemptCount: { increment: 1 } }
  });
  if (claimed.count !== 1) throw new PatientVerificationError("ATTEMPTS_EXHAUSTED");

  try {
    await verifySmsOtp(decryptProviderChallenge(challenge.providerChallengeCiphertext), code);
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        actorId: userId,
        action: "patient_verification.otp.failed",
        entityType: "user",
        entityId: userId,
        metadata: { challengeId: challenge.id }
      });
    });
    throw mapOtpError(error);
  }

  const verified = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, normalizedPhone: challenge.normalizedPhone },
      data: { phoneVerifiedAt: now }
    });
    if (updated.count !== 1) return false;
    await tx.phoneVerificationChallenge.updateMany({
      where: { id: challenge.id, userId, verifiedAt: null },
      data: { verifiedAt: now }
    });
    await writeAuditLog(tx, {
      actorId: userId,
      action: "patient_verification.otp.verified",
      entityType: "user",
      entityId: userId,
      metadata: { challengeId: challenge.id }
    });
    return true;
  });

  if (!verified) throw new PatientVerificationError("CHALLENGE_INVALIDATED");
}

export function getPatientVerificationMessage(error: unknown): { status: number; message: string } {
  if (!(error instanceof PatientVerificationError)) return { status: 503, message: "ยังไม่สามารถยืนยันเบอร์โทรได้ กรุณาลองใหม่" };

  const messages: Record<PatientVerificationError["code"], { status: number; message: string }> = {
    CONFIGURATION_ERROR: { status: 503, message: "ระบบยืนยันเบอร์โทรยังไม่พร้อมใช้งาน" },
    PROFILE_REQUIRED: { status: 400, message: "กรุณากรอกข้อมูลให้ครบก่อนยืนยันเบอร์โทร" },
    PHONE_IN_USE: { status: 409, message: "เบอร์นี้ใช้ยืนยันกับบัญชีอื่นแล้ว" },
    RATE_LIMITED: { status: 429, message: "กรุณารอก่อนขอรหัสอีกครั้ง" },
    CHALLENGE_NOT_FOUND: { status: 404, message: "ไม่พบคำขอยืนยันเบอร์โทร" },
    CHALLENGE_EXPIRED: { status: 410, message: "รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่" },
    ATTEMPTS_EXHAUSTED: { status: 429, message: "ลองรหัสเกินกำหนด กรุณาขอรหัสใหม่" },
    CHALLENGE_INVALIDATED: { status: 409, message: "คำขอยืนยันนี้ใช้ไม่ได้แล้ว กรุณาขอรหัสใหม่" },
    OTP_REJECTED: { status: 400, message: "รหัส OTP ไม่ถูกต้องหรือไม่สามารถยืนยันได้" },
    OTP_UNAVAILABLE: { status: 503, message: "ผู้ให้บริการ OTP ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" }
  };
  return messages[error.code];
}
