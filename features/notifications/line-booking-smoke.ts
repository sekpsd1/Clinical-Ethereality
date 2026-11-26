import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { pushLineBookingAlert } from "@/lib/notifications/line-push";

const smokeDurationMs = 15 * 60_000;
const smokeText = "ทดสอบการรับแจ้งเตือนจากคลินิก";
const recipientSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  lineUserId: z.string().regex(/^U[0-9a-f]{32}$/i),
  retryKey: z.string().uuid()
}).strict();

const baseScopeSchema = z.object({
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  sendKey: z.string().regex(/^[0-9a-f]{64}$/),
  admin: recipientSchema
}).strict();
const pairScopeSchema = baseScopeSchema.extend({ doctor: recipientSchema }).refine(({ doctor, admin }) =>
  doctor.userId !== admin.userId &&
  doctor.lineUserId.toLowerCase() !== admin.lineUserId.toLowerCase() &&
  doctor.retryKey.toLowerCase() !== admin.retryKey.toLowerCase()
);
const scopeSchema = z.union([
  pairScopeSchema,
  baseScopeSchema.extend({ mode: z.literal("admin-only") })
]);

function getSmokeScope() {
  if (process.env.ENABLE_LINE_BOOKING_ALERTS === "true") return null;
  try {
    const scope = scopeSchema.parse(JSON.parse(process.env.LINE_BOOKING_ALERT_SMOKE_SCOPE ?? ""));
    const start = Date.parse(scope.startsAt);
    const end = Date.parse(scope.expiresAt);
    const now = Date.now();
    if (start <= now && now < end && end - start <= smokeDurationMs) return scope;
  } catch {
    // An invalid or absent scope leaves the test disabled.
  }
  return null;
}

function matchesSecret(value: string | null, expected: string) {
  const received = Buffer.from(value ?? "");
  const secret = Buffer.from(expected);
  return received.length === secret.length && timingSafeEqual(received, secret);
}

async function readLineIdentity(path: string, token: string, field: "basicId" | "userId") {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000)
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const id = (data as Record<string, unknown>)[field];
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

export async function runLineBookingSmoke(headers: Headers) {
  const scope = getSmokeScope();
  if (!scope) return { status: 404, body: { ok: false } };
  const jobSecret = process.env.LINE_BOOKING_ALERT_JOB_SECRET;
  if (!jobSecret || jobSecret.length < 32 ||
    !matchesSecret(headers.get("x-clinical-job-secret"), jobSecret)) {
    return { status: 401, body: { ok: false } };
  }

  const action = headers.get("x-clinical-line-smoke-action");
  if (action !== "preflight" && action !== "send") return { status: 400, body: { ok: false } };
  if (action === "send" && !matchesSecret(headers.get("x-clinical-line-smoke-key"), scope.sendKey)) {
    return { status: 401, body: { ok: false } };
  }

  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token) return { status: 503, body: { ok: false, result: { state: "token_unavailable" } } };
  const doctorScope = "doctor" in scope ? scope.doctor : null;
  if (!doctorScope && scope.admin.userId !== process.env.LINE_BOOKING_ALERT_ADMIN_USER_ID?.trim()) {
    return { status: 409, body: { ok: false, result: { state: "recipient_mismatch" } } };
  }
  const targets = doctorScope ? [doctorScope, scope.admin] : [scope.admin];
  const users = await prisma.user.findMany({
    where: { id: { in: targets.map((recipient) => recipient.userId) } },
    select: { id: true, role: true, status: true, lineUserId: true, doctorProfile: { select: { status: true } } }
  });
  const doctor = doctorScope && users.find((user) => user.id === doctorScope.userId);
  const admin = users.find((user) => user.id === scope.admin.userId);
  if ((doctorScope && (!doctor || doctor.role !== "doctor" || doctor.status !== "active" ||
    doctor.doctorProfile?.status !== "approved" || doctor.lineUserId !== doctorScope.lineUserId)) ||
    admin?.role !== "admin" || admin.status !== "active" ||
    admin.lineUserId !== scope.admin.lineUserId) {
    return { status: 409, body: { ok: false, result: { state: "recipient_mismatch" } } };
  }

  if (await readLineIdentity("info", token, "basicId") !== "@vwe9449c") {
    return { status: 502, body: { ok: false, result: { state: "oa_unverified" } } };
  }
  const profiles = await Promise.all(targets.map((recipient) =>
    readLineIdentity(`profile/${recipient.lineUserId}`, token, "userId")
  ));
  if (!targets.every((recipient, index) => profiles[index] === recipient.lineUserId)) {
    return { status: 409, body: { ok: false, result: { state: "profile_unverified" } } };
  }
  if (Date.now() >= Date.parse(scope.expiresAt)) return { status: 404, body: { ok: false } };
  if (action === "preflight") return { status: 200, body: { ok: true, result: { state: "ready" } } };

  // Fixed per-recipient retry keys deduplicate concurrent calls at LINE within this short window.
  const sendOrder = doctorScope ? [scope.admin, doctorScope] : [scope.admin];
  const [adminOutcome, doctorOutcome] = await Promise.all(sendOrder.map(
    ({ lineUserId, retryKey }) => pushLineBookingAlert({ token, lineUserId, retryKey, text: smokeText })
  ));
  return {
    status: 200,
    body: {
      ok: adminOutcome === "accepted" && (!doctorScope || doctorOutcome === "accepted"),
      result: { state: "attempted", ...(doctorScope ? { doctor: doctorOutcome } : {}), admin: adminOutcome }
    }
  };
}
