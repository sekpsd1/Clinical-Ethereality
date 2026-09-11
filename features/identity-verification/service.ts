import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { getAppEnv } from "@/lib/env/schema";
import { normalizeThaiNationalId } from "@/lib/identity/thai-national-id";
import { normalizeThaiMobileNumber } from "@/lib/identity/thai-phone";
import { prisma } from "@/lib/db/prisma";
import {
  classifySmsOtpDatabaseError,
  getSmsOtpReadiness,
  requestSmsOtp,
  SmsOtpError,
  verifySmsOtp,
  writeSmsOtpDiagnostic,
  type SmsOtpDiagnosticLogger,
  type SmsOtpDiagnosticStage,
  type SmsOtpPreflightComponent
} from "@/lib/sms/otp";
import type { RequestPhoneVerificationInput } from "@/features/identity-verification/schema";

const otpTtlMs = 10 * 60 * 1000;
const resendDelayMs = 60 * 1000;
const requestWindowMs = 60 * 60 * 1000;
const maxRequestsPerWindow = 3;
const maxAttempts = 5;

type PatientVerificationRequestOptions = {
  diagnosticLogger?: SmsOtpDiagnosticLogger;
};

export type PatientVerificationStatus = {
  fullName: string | null;
  dateOfBirth: string | null;
  nationalId: string | null;
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
      | "NATIONAL_ID_IN_USE"
      | "RATE_LIMITED"
      | "CHALLENGE_NOT_FOUND"
      | "CHALLENGE_EXPIRED"
      | "ATTEMPTS_EXHAUSTED"
      | "CHALLENGE_INVALIDATED"
      | "OTP_REJECTED"
      | "OTP_REQUEST_UNAVAILABLE"
      | "OTP_UNAVAILABLE",
    public readonly retryAfterSeconds?: number
  ) {
    super(code);
    this.name = "PatientVerificationError";
  }
}

function getRetryAfterSeconds(retryAt: Date, now: Date): number {
  return Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1000));
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

function mapOtpError(error: unknown, retryAfterSeconds?: number): PatientVerificationError {
  if (error instanceof SmsOtpError) {
    if (error.code === "CONFIGURATION_ERROR") return new PatientVerificationError("CONFIGURATION_ERROR");
    if (error.code === "PROVIDER_UNAVAILABLE") {
      return new PatientVerificationError("OTP_UNAVAILABLE", retryAfterSeconds);
    }
  }

  return new PatientVerificationError("OTP_REJECTED");
}

function writeRequestPreflightFailure(
  component: SmsOtpPreflightComponent,
  error: unknown,
  diagnosticLogger?: SmsOtpDiagnosticLogger
): void {
  writeSmsOtpDiagnostic(
    {
      stage: "request_preflight",
      preflightComponent: component,
      databaseErrorCategory: classifySmsOtpDatabaseError(error),
      applicationHttpStatus: 503,
      providerHttpStatus: null,
      providerErrorCode: null,
      providerErrorCategory: "not_applicable"
    },
    diagnosticLogger
  );
}

async function runRequestPersistenceStage<T>(
  stage: Extract<SmsOtpDiagnosticStage, "request_preflight" | "request_persistence">,
  operation: () => Promise<T>,
  diagnosticLogger?: SmsOtpDiagnosticLogger
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PatientVerificationError) {
      throw error;
    }

    writeSmsOtpDiagnostic(
      {
        stage,
        applicationHttpStatus: 503,
        providerHttpStatus: null,
        providerErrorCode: null,
        providerErrorCategory: "not_applicable"
      },
      diagnosticLogger
    );
    throw error;
  }
}

async function runRequestPreflightBatch<A, B>(
  first: { component: SmsOtpPreflightComponent; operation: () => Promise<A> },
  second: { component: SmsOtpPreflightComponent; operation: () => Promise<B> },
  diagnosticLogger?: SmsOtpDiagnosticLogger
): Promise<[A, B]> {
  const results = await Promise.allSettled([first.operation(), second.operation()] as const);
  const checks = [first, second] as const;

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.status === "rejected") {
      if (result.reason instanceof PatientVerificationError) {
        throw result.reason;
      }

      writeRequestPreflightFailure(checks[index].component, result.reason, diagnosticLogger);
      throw result.reason;
    }
  }

  return [
    (results[0] as PromiseFulfilledResult<A>).value,
    (results[1] as PromiseFulfilledResult<B>).value
  ];
}

async function getRequestWindowRetryAfterSeconds(
  userId: string,
  windowStartedAt: Date,
  requestStartedAt: Date,
  diagnosticLogger?: SmsOtpDiagnosticLogger
): Promise<number> {
  try {
    const oldestChallenge = await prisma.phoneVerificationChallenge.findFirst({
      where: { userId, requestedAt: { gte: windowStartedAt } },
      orderBy: { requestedAt: "asc" },
      select: { requestedAt: true }
    });
    return oldestChallenge
      ? getRetryAfterSeconds(
          new Date(oldestChallenge.requestedAt.getTime() + requestWindowMs),
          requestStartedAt
        )
      : Math.ceil(requestWindowMs / 1000);
  } catch (error) {
    writeRequestPreflightFailure("request_count_lookup", error, diagnosticLogger);
    throw error;
  }
}

async function claimPhoneOtpDispatch(
  userId: string,
  claimedAt: Date,
  currentClaimedUntil: Date | null | undefined,
  diagnosticLogger?: SmsOtpDiagnosticLogger
): Promise<Date> {
  const claimedUntil = new Date(claimedAt.getTime() + resendDelayMs);
  let claimed: { count: number };

  try {
    // One conditional UPDATE is the cross-request serialization boundary.
    claimed = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { phoneOtpDispatchClaimedUntil: null },
          { phoneOtpDispatchClaimedUntil: { lte: claimedAt } }
        ]
      },
      data: { phoneOtpDispatchClaimedUntil: claimedUntil }
    });
  } catch (error) {
    writeRequestPreflightFailure("dispatch_claim", error, diagnosticLogger);
    throw error;
  }

  if (claimed.count !== 1) {
    let activeClaimedUntil = currentClaimedUntil;
    let refreshedClaim = false;
    try {
      const latestUserClaim = await prisma.user.findUnique({
        where: { id: userId },
        select: { phoneOtpDispatchClaimedUntil: true }
      });
      if (latestUserClaim && "phoneOtpDispatchClaimedUntil" in latestUserClaim) {
        activeClaimedUntil = latestUserClaim.phoneOtpDispatchClaimedUntil;
        refreshedClaim = true;
      }
    } catch {
      // The atomic claim already proved this request is rate limited. If the
      // best-effort expiry lookup fails, retain the bounded preflight fallback.
    }
    const retryAfterSeconds =
      activeClaimedUntil && activeClaimedUntil > claimedAt
        ? getRetryAfterSeconds(activeClaimedUntil, claimedAt)
        : refreshedClaim
          ? 1
          : Math.ceil(resendDelayMs / 1000);
    throw new PatientVerificationError("RATE_LIMITED", retryAfterSeconds);
  }

  return claimedUntil;
}

function mayReleaseDispatchClaim(error: unknown): boolean {
  if (!(error instanceof SmsOtpError)) return false;
  if (error.code === "CONFIGURATION_ERROR") return true;
  if (error.code !== "PROVIDER_REJECTED") return false;

  const status = error.diagnostic?.providerHttpStatus;
  // A provider 2xx/timeout/network/5xx outcome may already have sent an OTP, so its claim expires naturally.
  return typeof status === "number" && status >= 400 && status < 500;
}

async function releasePhoneOtpDispatchClaim(userId: string, claimedUntil: Date): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId, phoneOtpDispatchClaimedUntil: claimedUntil },
      data: { phoneOtpDispatchClaimedUntil: null }
    });
  } catch {
    // Fail closed: the bounded claim expires without exposing provider or database details.
  }
}

function toDateOfBirth(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toStatus(user: {
  fullName: string | null;
  dateOfBirth: Date | null;
  nationalId: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  phoneVerifiedAt: Date | null;
} | null): PatientVerificationStatus {
  const isVerified = Boolean(user?.fullName && user.dateOfBirth && user.nationalId && user.phone && user.normalizedPhone && user.phoneVerifiedAt);

  return {
    fullName: user?.fullName ?? null,
    dateOfBirth: user?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    nationalId: user?.nationalId ?? null,
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
      nationalId: true,
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
  input: RequestPhoneVerificationInput,
  options: PatientVerificationRequestOptions = {}
): Promise<
  { challengeId: string; phoneLabel: string; expiresAt: string; retryAfterSeconds: number }
  | { alreadyVerified: true }
> {
  const env = getAppEnv();
  if (!getSmsOtpReadiness(env).isConfigured || !env.SMS_OTP_CHALLENGE_ENCRYPTION_KEY) {
    throw new PatientVerificationError("CONFIGURATION_ERROR");
  }

  const normalizedPhone = normalizeThaiMobileNumber(input.phone);
  const nationalId = normalizeThaiNationalId(input.nationalId);
  const dateOfBirth = toDateOfBirth(input.dateOfBirth);
  const requestStartedAt = new Date();
  const [user, existingIdentityOwner] = await runRequestPreflightBatch(
    {
      component: "user_lookup",
      operation: () =>
        prisma.user.findUnique({
          where: { id: userId },
          select: { normalizedPhone: true, phoneVerifiedAt: true, phoneOtpDispatchClaimedUntil: true }
        })
    },
    {
      component: "phone_owner_lookup",
      operation: () =>
        prisma.user.findFirst({
          where: {
            id: { not: userId },
            OR: [{ normalizedPhone: normalizedPhone.e164 }, { nationalId }]
          },
          select: { normalizedPhone: true, nationalId: true }
        })
    },
    options.diagnosticLogger
  );

  if (!user) {
    throw new PatientVerificationError("PROFILE_REQUIRED");
  }
  if (existingIdentityOwner?.nationalId === nationalId) {
    throw new PatientVerificationError("NATIONAL_ID_IN_USE");
  }
  if (existingIdentityOwner?.normalizedPhone === normalizedPhone.e164) {
    throw new PatientVerificationError("PHONE_IN_USE");
  }

  if (user.normalizedPhone === normalizedPhone.e164 && user.phoneVerifiedAt) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { fullName: input.fullName, dateOfBirth, nationalId, phone: normalizedPhone.local }
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

  const [recentChallenge, requestCount] = await runRequestPreflightBatch(
    {
      component: "latest_challenge_lookup",
      operation: () =>
        prisma.phoneVerificationChallenge.findFirst({
          where: { userId },
          orderBy: { requestedAt: "desc" },
          select: { requestedAt: true }
        })
    },
    {
      component: "request_count_lookup",
      operation: () =>
        prisma.phoneVerificationChallenge.count({
          where: { userId, requestedAt: { gte: new Date(requestStartedAt.getTime() - requestWindowMs) } }
        })
    },
    options.diagnosticLogger
  );

  if (recentChallenge && requestStartedAt.getTime() - recentChallenge.requestedAt.getTime() < resendDelayMs) {
    throw new PatientVerificationError(
      "RATE_LIMITED",
      getRetryAfterSeconds(new Date(recentChallenge.requestedAt.getTime() + resendDelayMs), requestStartedAt)
    );
  }
  if (requestCount >= maxRequestsPerWindow) {
    const retryAfterSeconds = await getRequestWindowRetryAfterSeconds(
      userId,
      new Date(requestStartedAt.getTime() - requestWindowMs),
      requestStartedAt,
      options.diagnosticLogger
    );
    throw new PatientVerificationError("RATE_LIMITED", retryAfterSeconds);
  }

  const claimedAt = new Date();
  const claimedUntil = await claimPhoneOtpDispatch(
    userId,
    claimedAt,
    user.phoneOtpDispatchClaimedUntil,
    options.diagnosticLogger
  );
  let providerChallenge;
  try {
    providerChallenge = await requestSmsOtp(normalizedPhone.local, {
      env,
      diagnosticLogger: options.diagnosticLogger
    });
  } catch (error) {
    const releasesDispatchClaim = mayReleaseDispatchClaim(error);
    if (releasesDispatchClaim) {
      await releasePhoneOtpDispatchClaim(userId, claimedUntil);
    }
    throw mapOtpError(
      error,
      releasesDispatchClaim ? undefined : getRetryAfterSeconds(claimedUntil, new Date())
    );
  }

  const expiresAt = new Date(claimedAt.getTime() + otpTtlMs);
  let challenge: { id: string };
  try {
    challenge = await runRequestPersistenceStage(
      "request_persistence",
      () =>
        prisma.$transaction(async (tx) => {
          await tx.phoneVerificationChallenge.updateMany({
            where: { userId, verifiedAt: null, expiresAt: { gt: claimedAt } },
            data: { expiresAt: claimedAt }
          });
          await tx.user.update({
            where: { id: userId },
            data: {
              fullName: input.fullName,
              dateOfBirth,
              nationalId,
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
              requestedAt: claimedAt
            },
            select: { id: true }
          });
          await writeAuditLog(tx, {
            actorId: userId,
            action: "patient_verification.otp.request",
            entityType: "user",
            entityId: userId,
            metadata: {
              provider: providerChallenge.provider,
              phoneChanged: user.normalizedPhone !== normalizedPhone.e164
            }
          });
          return created;
        }),
      options.diagnosticLogger
    );
  } catch (error) {
    if (error instanceof PatientVerificationError) {
      throw error;
    }
    throw new PatientVerificationError(
      "OTP_REQUEST_UNAVAILABLE",
      getRetryAfterSeconds(claimedUntil, new Date())
    );
  }

  return {
    challengeId: challenge.id,
    phoneLabel: providerChallenge.phoneLabel,
    expiresAt: expiresAt.toISOString(),
    retryAfterSeconds: getRetryAfterSeconds(claimedUntil, new Date())
  };
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

export function getPatientVerificationMessage(error: unknown): {
  status: number;
  message: string;
  retryAfterSeconds?: number;
} {
  if (!(error instanceof PatientVerificationError)) return { status: 503, message: "ยังไม่สามารถยืนยันเบอร์โทรได้ กรุณาลองใหม่" };

  const messages: Record<PatientVerificationError["code"], { status: number; message: string }> = {
    CONFIGURATION_ERROR: { status: 503, message: "ระบบยืนยันเบอร์โทรยังไม่พร้อมใช้งาน" },
    PROFILE_REQUIRED: { status: 400, message: "กรุณากรอกข้อมูลให้ครบก่อนยืนยันเบอร์โทร" },
    PHONE_IN_USE: { status: 409, message: "เบอร์นี้ใช้ยืนยันกับบัญชีอื่นแล้ว" },
    NATIONAL_ID_IN_USE: { status: 409, message: "เลขบัตรประชาชนนี้ใช้กับบัญชีอื่นแล้ว" },
    RATE_LIMITED: { status: 429, message: "กรุณารอก่อนขอรหัสอีกครั้ง" },
    CHALLENGE_NOT_FOUND: { status: 404, message: "ไม่พบคำขอยืนยันเบอร์โทร" },
    CHALLENGE_EXPIRED: { status: 410, message: "รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่" },
    ATTEMPTS_EXHAUSTED: { status: 429, message: "ลองรหัสเกินกำหนด กรุณาขอรหัสใหม่" },
    CHALLENGE_INVALIDATED: { status: 409, message: "คำขอยืนยันนี้ใช้ไม่ได้แล้ว กรุณาขอรหัสใหม่" },
    OTP_REJECTED: { status: 400, message: "รหัส OTP ไม่ถูกต้องหรือไม่สามารถยืนยันได้" },
    OTP_REQUEST_UNAVAILABLE: { status: 503, message: "ระบบยังไม่สามารถเตรียมการยืนยัน OTP ได้ กรุณาลองใหม่ภายหลัง" },
    OTP_UNAVAILABLE: { status: 503, message: "ผู้ให้บริการ OTP ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" }
  };
  const response = messages[error.code];
  return error.retryAfterSeconds
    ? { ...response, retryAfterSeconds: error.retryAfterSeconds }
    : response;
}
