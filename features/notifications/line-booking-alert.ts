import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getBookedConsultationDurationMinutes } from "@/features/consultations/duration-policy";

const recipientSchema = z.object({
  role: z.enum(["doctor", "admin"]),
  userId: z.string(),
  retryKey: z.string().uuid(),
  status: z.enum(["pending", "accepted", "failed", "skipped"]),
  attempts: z.number().int().nonnegative(),
  firstAttemptAt: z.number().nullable(),
  lineUserId: z.string().nullable(),
  text: z.string().nullable(),
  error: z.string().nullable()
});

export const bookingAlertSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["all", "test"]).default("all"),
  status: z.enum(["pending", "processing", "done"]),
  nextAttemptAt: z.number(),
  lease: z.string().nullable(),
  doctorId: z.string(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  expiresAt: z.number(),
  recipients: z.array(recipientSchema).length(2)
});

export type BookingAlert = z.infer<typeof bookingAlertSchema>;
export type BookingAlertRecipient = BookingAlert["recipients"][number];

const testScopeSchema = z.object({
  consultationId: z.string().min(1),
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  adminUserId: z.string().min(1),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime()
}).strict();

type TestScope = z.infer<typeof testScopeSchema>;
type AlertMode = { kind: "all"; adminUserId: string } | { kind: "test"; scope: TestScope; adminUserId: string };
type BookingIdentity = Pick<TestScope, "consultationId" | "patientId" | "doctorId">;

export function getBookingAlertMode(now: Date): AlertMode | null {
  if (process.env.ENABLE_LINE_BOOKING_ALERTS !== "true") return null;
  const adminUserId = process.env.LINE_BOOKING_ALERT_ADMIN_USER_ID?.trim() ?? "";
  if (process.env.LINE_BOOKING_ALERT_MODE === "all") return { kind: "all", adminUserId };
  if (process.env.LINE_BOOKING_ALERT_MODE !== "test" || !adminUserId) return null;

  try {
    const { success, data } = testScopeSchema.safeParse(JSON.parse(process.env.LINE_BOOKING_ALERT_TEST_SCOPE ?? ""));
    if (!success || data.adminUserId !== adminUserId) return null;
    const start = Date.parse(data.startsAt);
    const end = Date.parse(data.expiresAt);
    if (now.getTime() < start || now.getTime() >= end || end - start > 60 * 60_000) return null;
    return { kind: "test", scope: data, adminUserId };
  } catch {
    return null;
  }
}

export function isBookingInAlertScope(mode: AlertMode, booking: BookingIdentity): boolean {
  return mode.kind === "all" || (
    mode.scope.consultationId === booking.consultationId &&
    mode.scope.patientId === booking.patientId &&
    mode.scope.doctorId === booking.doctorId
  );
}

// Added only to the existing doctor notification in the successful payment
// transaction. Old notifications and disabled confirmations never become jobs.
export function bookingLineAlertMetadata(input: BookingIdentity & {
  doctorUserId: string;
  scheduledAt: Date | null;
  bookedDurationMinutes: number | null;
}, now = new Date()): { lineBookingAlert?: BookingAlert } {
  const mode = getBookingAlertMode(now);
  if (!mode || !isBookingInAlertScope(mode, input) || !input.scheduledAt ||
    !Number.isFinite(input.scheduledAt.getTime()) || input.scheduledAt <= now) return {};

  const recipients: BookingAlert["recipients"] = [
    { role: "doctor", userId: input.doctorUserId },
    { role: "admin", userId: mode.adminUserId }
  ].map((recipient) => ({
    ...recipient,
    role: recipient.role as "doctor" | "admin",
    retryKey: randomUUID(), status: "pending", attempts: 0,
    firstAttemptAt: null, lineUserId: null, text: null, error: null
  }));

  return { lineBookingAlert: {
    version: 1, mode: mode.kind, status: "pending", nextAttemptAt: now.getTime(), lease: null,
    doctorId: input.doctorId, scheduledAt: input.scheduledAt.toISOString(),
    durationMinutes: getBookedConsultationDurationMinutes(input.bookedDurationMinutes),
    expiresAt: Math.min(input.scheduledAt.getTime(), now.getTime() + 23 * 60 * 60 * 1000,
      mode.kind === "test" ? Date.parse(mode.scope.expiresAt) : Number.POSITIVE_INFINITY),
    recipients
  } };
}

export function formatBookingAlert(alert: Pick<BookingAlert, "scheduledAt" | "durationMinutes">, origin: string, role: "doctor" | "admin") {
  const start = new Date(alert.scheduledAt);
  const end = new Date(start.getTime() + alert.durationMinutes * 60_000);
  const formatter = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  // Include both dates for appointments that cross midnight. Generic protected
  // link contains no consultation ID or bearer credentials.
  const path = role === "doctor" ? "/doctor/consultations" : "/admin/schedules";
  return `มีนัดปรึกษาใหม่ที่ยืนยันการชำระเงินแล้ว\nเริ่ม ${formatter.format(start)}\nสิ้นสุด ${formatter.format(end)} (เวลาไทย)\nดูตารางนัดหมาย ${new URL(path, origin).href}`;
}
