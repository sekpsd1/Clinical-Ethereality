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

// Added only to the existing doctor notification in the successful payment
// transaction. Old notifications and disabled confirmations never become jobs.
export function bookingLineAlertMetadata(input: {
  doctorId: string;
  doctorUserId: string;
  scheduledAt: Date | null;
  bookedDurationMinutes: number | null;
}, now = new Date()): { lineBookingAlert?: BookingAlert } {
  if (process.env.ENABLE_LINE_BOOKING_ALERTS !== "true" || !input.scheduledAt ||
    !Number.isFinite(input.scheduledAt.getTime()) || input.scheduledAt <= now) return {};

  const recipients: BookingAlert["recipients"] = [
    { role: "doctor", userId: input.doctorUserId },
    { role: "admin", userId: process.env.LINE_BOOKING_ALERT_ADMIN_USER_ID?.trim() ?? "" }
  ].map((recipient) => ({
    ...recipient,
    role: recipient.role as "doctor" | "admin",
    retryKey: randomUUID(), status: "pending", attempts: 0,
    firstAttemptAt: null, lineUserId: null, text: null, error: null
  }));

  return { lineBookingAlert: {
    version: 1, status: "pending", nextAttemptAt: now.getTime(), lease: null,
    doctorId: input.doctorId, scheduledAt: input.scheduledAt.toISOString(),
    durationMinutes: getBookedConsultationDurationMinutes(input.bookedDurationMinutes),
    expiresAt: Math.min(input.scheduledAt.getTime(), now.getTime() + 23 * 60 * 60 * 1000),
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
