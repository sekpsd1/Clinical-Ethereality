import { randomUUID } from "node:crypto";
import type { Notification, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { pushLineBookingAlert } from "@/lib/notifications/line-push";
import { getBookedConsultationDurationMinutes } from "@/features/consultations/duration-policy";
import { bookingAlertSchema, formatBookingAlert, getBookingAlertMode, isBookingInAlertScope, type BookingAlert, type BookingAlertRecipient } from "./line-booking-alert";

const leaseMilliseconds = 60_000;
const lineUserIdPattern = /^U[0-9a-f]{32}$/i;
type Metadata = Prisma.JsonObject;

function asMetadata(value: Prisma.JsonValue): Metadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function replaceState(id: string, previous: Metadata, alert: BookingAlert, attention = false) {
  const next = JSON.parse(JSON.stringify({ ...previous, lineBookingAlert: alert, lineBookingAlertAttention: attention })) as Metadata;
  const changed = await prisma.notification.updateMany({
    where: { id, metadataJson: { equals: previous } },
    data: { metadataJson: next }
  });
  return changed.count === 1 ? next : null;
}

async function eligibleLineUser(recipient: BookingAlertRecipient, doctorUserId: string) {
  if (!recipient.userId || recipient.role === "doctor" && recipient.userId !== doctorUserId ||
    recipient.role === "admin" && recipient.userId !== process.env.LINE_BOOKING_ALERT_ADMIN_USER_ID?.trim()) return null;
  const user = await prisma.user.findUnique({
    where: { id: recipient.userId },
    select: { role: true, status: true, lineUserId: true, doctorProfile: { select: { status: true } } }
  });
  if (!user || user.status !== "active" || user.role !== recipient.role ||
    recipient.role === "doctor" && user.doctorProfile?.status !== "approved" ||
    !lineUserIdPattern.test(user.lineUserId)) return null;
  return user.lineUserId;
}

async function nudgeAdmin(notificationId: string, alert: BookingAlert) {
  const admin = alert.recipients.find((recipient) => recipient.role === "admin");
  if (!admin || !await eligibleLineUser(admin, "")) return;
  await prisma.notification.upsert({
    where: { id: `line-alert-attention:${notificationId}` },
    create: {
      id: `line-alert-attention:${notificationId}`, userId: admin.userId,
      type: "system", channel: "in_app", title: "การแจ้งเตือน LINE ต้องตรวจสอบ",
      body: "มีการแจ้งเตือนนัดหมายที่ระบบส่งไม่สำเร็จ กรุณาตรวจสถานะงาน LINE",
      metadataJson: { href: "/admin/notifications", audienceRole: "admin" }
    },
    update: {}
  });
}

export async function runLineBookingAlerts(now = new Date()) {
  const startedAt = Date.now();
  const currentTime = () => now.getTime() + Date.now() - startedAt;
  const result = { disabled: false, claimed: 0, accepted: 0, deferred: 0, attentionRequired: 0 };
  const mode = getBookingAlertMode(now);
  if (!mode) return { ...result, disabled: true };
  const testConsultationId = mode.kind === "test" ? mode.scope.consultationId : null;
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!token || !configuredOrigin) throw new Error("LINE booking alerts are not configured.");
  const origin = new URL(configuredOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("Invalid LINE booking alert origin.");

  // Prisma's MySQL JSON range filter misses integer millisecond timestamps.
  // Compare the extracted timestamp as an integer and bind the cutoff.
  const jobs = await prisma.$queryRaw<Pick<Notification, "id" | "metadataJson">[]>`
    SELECT id, metadataJson
    FROM Notification
    WHERE channel = 'in_app' AND type = 'consultation'
      AND JSON_EXTRACT(metadataJson, '$.lineBookingAlert.version') = 1
      AND JSON_TYPE(JSON_EXTRACT(metadataJson, '$.lineBookingAlert.nextAttemptAt')) IN ('INTEGER', 'UNSIGNED INTEGER')
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.lineBookingAlert.nextAttemptAt')) AS UNSIGNED) <= ${now.getTime()}
      AND JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.lineBookingAlert.status')) IN ('pending', 'processing')
      AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.lineBookingAlert.mode')), 'all') = ${mode.kind}
      AND (${testConsultationId} IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.consultationId')) = ${testConsultationId})
    ORDER BY createdAt, id
    LIMIT 2
  `;

  for (const job of jobs) {
    let metadata = asMetadata(job.metadataJson);
    const parsed = bookingAlertSchema.safeParse(metadata.lineBookingAlert);
    if (!parsed.success) { result.attentionRequired++; continue; }
    const alert = parsed.data;
    const consultationId = typeof metadata.consultationId === "string" ? metadata.consultationId : "";
    if (alert.mode !== mode.kind || (testConsultationId && consultationId !== testConsultationId)) continue;
    alert.status = "processing";
    alert.lease = randomUUID();
    alert.nextAttemptAt = currentTime() + leaseMilliseconds;
    const claimed = await replaceState(job.id, metadata, alert);
    if (!claimed) continue;
    metadata = claimed;
    result.claimed++;

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { status: true, patientId: true, doctorId: true, scheduledAt: true, bookedDurationMinutes: true,
        doctor: { select: { userId: true, status: true } }, payment: { select: { status: true } } }
    });
    const current = consultation?.status === "scheduled" && consultation.payment?.status === "verified" &&
      consultation.doctorId === alert.doctorId && consultation.doctor.status === "approved" &&
      consultation.scheduledAt?.toISOString() === alert.scheduledAt &&
      getBookedConsultationDurationMinutes(consultation.bookedDurationMinutes) === alert.durationMinutes;
    const isStillInScope = () => {
      const activeMode = getBookingAlertMode(new Date(currentTime()));
      return activeMode && activeMode.kind === alert.mode && consultation &&
        isBookingInAlertScope(activeMode, { consultationId, patientId: consultation.patientId, doctorId: consultation.doctorId }) &&
        (activeMode.kind === "all" || alert.recipients.some(({ role, userId }) => role === "admin" && userId === activeMode.adminUserId));
    };
    const usedLineIds = new Set<string>();
    let lostLease = false;
    for (const recipient of alert.recipients) {
      if (recipient.lineUserId) usedLineIds.add(recipient.lineUserId);
      if (recipient.status !== "pending") continue;
      if (!current || !isStillInScope() || currentTime() >= alert.expiresAt) {
        recipient.status = "skipped"; recipient.error = "booking_changed_or_expired";
        continue;
      }
      const lineUserId = await eligibleLineUser(recipient, consultation.doctor.userId);
      if (!lineUserId || recipient.lineUserId && recipient.lineUserId !== lineUserId) {
        recipient.status = "failed"; recipient.error = "recipient_ineligible";
        continue;
      }
      if (!recipient.lineUserId && usedLineIds.has(lineUserId)) {
        recipient.status = "skipped"; recipient.error = "duplicate_recipient";
        continue;
      }
      usedLineIds.add(lineUserId);
      recipient.lineUserId = lineUserId;
      recipient.text ??= formatBookingAlert(alert, origin.origin, recipient.role);
      recipient.firstAttemptAt ??= currentTime();
      recipient.attempts++;
      // Persist immutable recipient/content/key before the network call. A
      // crashed worker repeats the same request after its lease expires.
      alert.nextAttemptAt = currentTime() + leaseMilliseconds;
      const persisted = await replaceState(job.id, metadata, alert);
      if (!persisted) { lostLease = true; break; }
      metadata = persisted;
      if (!isStillInScope() || currentTime() >= alert.expiresAt) {
        recipient.status = "skipped"; recipient.error = "booking_changed_or_expired";
        continue;
      }
      const outcome = await pushLineBookingAlert({ token, lineUserId, retryKey: recipient.retryKey, text: recipient.text });
      if (outcome === "accepted") { recipient.status = "accepted"; result.accepted++; }
      else if (outcome === "failed" || recipient.attempts >= 8) {
        recipient.status = "failed"; recipient.error = "line_send_unavailable";
      } else result.deferred++;
    }
    if (lostLease) continue;
    const pending = alert.recipients.filter((recipient) => recipient.status === "pending");
    alert.status = pending.length ? "pending" : "done";
    alert.lease = null;
    const attempts = Math.max(...alert.recipients.map((recipient) => recipient.attempts));
    alert.nextAttemptAt = currentTime() + Math.min(60 * 60_000, 60_000 * 2 ** attempts);
    const attention = alert.recipients.some((recipient) => recipient.status === "failed" || recipient.error === "booking_changed_or_expired");
    if (await replaceState(job.id, metadata, alert, attention) && attention) {
      try { await nudgeAdmin(job.id, alert); }
      catch { /* Durable attention flag is also returned to the job monitor. */ }
    }
  }
  result.attentionRequired += await prisma.notification.count({
    where: { metadataJson: { path: "$.lineBookingAlertAttention", equals: true } }
  });
  return result;
}
