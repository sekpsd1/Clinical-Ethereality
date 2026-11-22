import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  findJobs: vi.fn(), updateJobs: vi.fn(), countJobs: vi.fn(), upsertNotification: vi.fn(),
  findConsultation: vi.fn(), findUser: vi.fn(), push: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {
  $queryRaw: mocks.findJobs,
  notification: { updateMany: mocks.updateJobs, count: mocks.countJobs, upsert: mocks.upsertNotification },
  consultation: { findUnique: mocks.findConsultation }, user: { findUnique: mocks.findUser }
} }));
vi.mock("@/lib/notifications/line-push", () => ({ pushLineBookingAlert: mocks.push }));

import { bookingLineAlertMetadata, formatBookingAlert, type BookingAlert } from "@/features/notifications/line-booking-alert";
import { runLineBookingAlerts } from "@/features/notifications/line-booking-job";

const now = new Date("2026-11-20T09:00:00.000Z");
const scheduledAt = new Date("2026-11-21T16:45:00.000Z");
const doctorLineId = `U${"a".repeat(32)}`;
const adminLineId = `U${"b".repeat(32)}`;
type Job = { id: string; metadataJson: Prisma.JsonObject; readAt?: Date };
type TestUser = { role: string; status: string; lineUserId: string; doctorProfile: { status: string } | null };
const jobs = new Map<string, Job>();
const users = new Map<string, TestUser>();
let consultation: {
  status: string; doctorId: string; scheduledAt: Date; bookedDurationMinutes: number | null;
  doctor: { userId: string; status: string }; payment: { status: string };
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function alertFor(id = "doctor-notification"): BookingAlert {
  return jobs.get(id)!.metadataJson.lineBookingAlert as unknown as BookingAlert;
}

function seedJob(): Job {
  const metadata = bookingLineAlertMetadata({ doctorId: "doctor-profile", doctorUserId: "doctor-user", scheduledAt, bookedDurationMinutes: 15 }, now);
  const job = { id: "doctor-notification", metadataJson: clone({ consultationId: "consultation-test", href: "/doctor/consultations", ...metadata }) as Prisma.JsonObject };
  jobs.set(job.id, job);
  return job;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ENABLE_LINE_BOOKING_ALERTS", "true");
  vi.stubEnv("LINE_BOOKING_ALERT_ADMIN_USER_ID", "admin-user");
  vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "mock-access-token");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://clinic.example");
  jobs.clear(); users.clear();
  users.set("doctor-user", { role: "doctor", status: "active", lineUserId: doctorLineId, doctorProfile: { status: "approved" } });
  users.set("admin-user", { role: "admin", status: "active", lineUserId: adminLineId, doctorProfile: null });
  consultation = { status: "scheduled", doctorId: "doctor-profile", scheduledAt, bookedDurationMinutes: 15,
    doctor: { userId: "doctor-user", status: "approved" }, payment: { status: "verified" } };
  mocks.findConsultation.mockImplementation(async () => consultation);
  mocks.findUser.mockImplementation(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null);
  mocks.findJobs.mockImplementation(async (_query: TemplateStringsArray, dueAt: number) => {
    return [...jobs.values()].filter((job) => {
      const alert = job.metadataJson.lineBookingAlert as unknown as BookingAlert;
      return alert.version === 1 && ["pending", "processing"].includes(alert.status) && alert.nextAttemptAt <= dueAt;
    }).map(clone);
  });
  // The database receives immutable JSON snapshots. Exact CAS equality catches
  // accidental mutation of the previous snapshot by the dispatcher.
  mocks.updateJobs.mockImplementation(async ({ where, data }: {
    where: { id: string; metadataJson: { equals: Prisma.JsonObject } };
    data: { metadataJson: Prisma.JsonObject };
  }) => {
    const row = jobs.get(where.id);
    if (!row || JSON.stringify(row.metadataJson) !== JSON.stringify(where.metadataJson.equals)) return { count: 0 };
    row.metadataJson = clone(data.metadataJson);
    return { count: 1 };
  });
  mocks.countJobs.mockImplementation(async () => [...jobs.values()].filter((job) => job.metadataJson.lineBookingAlertAttention === true).length);
  mocks.upsertNotification.mockResolvedValue({ id: "attention-notification" });
  mocks.push.mockResolvedValue("accepted");
});

afterEach(() => vi.unstubAllEnvs());

describe("confirmed booking LINE marker and minimal message", () => {
  it("does not mark disabled, missing, invalid, or already-started bookings", () => {
    const input = { doctorId: "doctor-profile", doctorUserId: "doctor-user", scheduledAt, bookedDurationMinutes: 15 };
    vi.stubEnv("ENABLE_LINE_BOOKING_ALERTS", "false");
    expect(bookingLineAlertMetadata(input, now)).toEqual({});
    vi.stubEnv("ENABLE_LINE_BOOKING_ALERTS", "true");
    for (const date of [null, new Date("invalid"), now, new Date(now.getTime() - 1)]) {
      expect(bookingLineAlertMetadata({ ...input, scheduledAt: date }, now)).toEqual({});
    }
  });

  it("snapshots only the assigned doctor and one explicitly configured Admin", () => {
    const alert = seedJob().metadataJson.lineBookingAlert as unknown as BookingAlert;
    expect(alert.recipients.map(({ role, userId }) => ({ role, userId }))).toEqual([
      { role: "doctor", userId: "doctor-user" }, { role: "admin", userId: "admin-user" }
    ]);
    expect(alert.durationMinutes).toBe(15);
    expect(alert.expiresAt).toBe(now.getTime() + 23 * 60 * 60_000);
    expect(alert.recipients[0].retryKey).not.toBe(alert.recipients[1].retryKey);
    expect(JSON.stringify(alert)).not.toMatch(/patient|nationalId|diagnosis|paymentId|transactionReference/);
  });

  it("renders Bangkok dates across midnight, the booked end time, and only generic protected role links", () => {
    const snapshot = { scheduledAt: scheduledAt.toISOString(), durationMinutes: 30 };
    const doctorText = formatBookingAlert(snapshot, "https://clinic.example", "doctor");
    expect(doctorText).toContain("21 พฤศจิกายน 2569 เวลา 23:45");
    expect(doctorText).toContain("22 พฤศจิกายน 2569 เวลา 00:15");
    expect(doctorText).toContain("https://clinic.example/doctor/consultations");
    expect(formatBookingAlert(snapshot, "https://clinic.example", "admin")).toContain("https://clinic.example/admin/schedules");
    expect(doctorText).not.toMatch(/consultation-test|doctor-user|patient|token|\?/);
  });

  it.each([15, 30, 45, 60, null])("uses authoritative booked duration %s including the legacy fallback", (duration) => {
    const marker = bookingLineAlertMetadata({ doctorId: "doctor-profile", doctorUserId: "doctor-user", scheduledAt, bookedDurationMinutes: duration }, now);
    expect(marker.lineBookingAlert?.durationMinutes).toBe(duration ?? 30);
  });
});

describe("durable LINE booking dispatcher", () => {
  it("does no database work or sends while disabled", async () => {
    seedJob(); vi.stubEnv("ENABLE_LINE_BOOKING_ALERTS", "false");
    expect((await runLineBookingAlerts(now)).disabled).toBe(true);
    expect(mocks.findJobs).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sends once to both authorized recipients, persists acceptance, and skips replay", async () => {
    seedJob();
    expect(await runLineBookingAlerts(now)).toMatchObject({ claimed: 1, accepted: 2, attentionRequired: 0 });
    expect(mocks.push.mock.calls.map(([payload]) => payload.lineUserId)).toEqual([doctorLineId, adminLineId]);
    expect(alertFor().status).toBe("done");
    expect(alertFor().recipients.map((recipient) => recipient.status)).toEqual(["accepted", "accepted"]);
    expect(JSON.stringify(mocks.push.mock.calls)).not.toContain("consultation-test");
    await runLineBookingAlerts(new Date(now.getTime() + 60 * 60_000));
    expect(mocks.push).toHaveBeenCalledTimes(2);
  });

  it("retries only the missed recipient with the identical persisted key, LINE ID, and text", async () => {
    seedJob(); mocks.push.mockResolvedValueOnce("retry").mockResolvedValueOnce("accepted");
    expect(await runLineBookingAlerts(now)).toMatchObject({ accepted: 1, deferred: 1 });
    const firstRequest = clone(mocks.push.mock.calls[0][0]);
    const due = alertFor().nextAttemptAt;
    await runLineBookingAlerts(new Date(due - 1));
    expect(mocks.push).toHaveBeenCalledTimes(2);
    await runLineBookingAlerts(new Date(due));
    expect(mocks.push).toHaveBeenCalledTimes(3);
    expect(mocks.push.mock.calls[2][0]).toEqual(firstRequest);
    expect(alertFor().recipients.map((recipient) => recipient.attempts)).toEqual([2, 1]);
    expect(alertFor().status).toBe("done");
  });

  it("allows only one concurrent worker to claim the same immutable metadata", async () => {
    seedJob();
    const results = await Promise.all([runLineBookingAlerts(now), runLineBookingAlerts(now)]);
    expect(results.reduce((sum, result) => sum + result.claimed, 0)).toBe(1);
    expect(mocks.push).toHaveBeenCalledTimes(2);
    expect(alertFor().status).toBe("done");
  });

  it.each(["lost_cas", "database_error"])("recovers a send accepted before final persistence (%s) using the same request", async (failure) => {
    seedJob();
    const persistNormally = mocks.updateJobs.getMockImplementation()!;
    let interrupted = false;
    mocks.updateJobs.mockImplementation(async (query) => {
      const nextAlert = query.data.metadataJson.lineBookingAlert as BookingAlert;
      if (!interrupted && nextAlert.status === "done") {
        interrupted = true;
        if (failure === "database_error") throw new Error("Mock database unavailable after accepted send");
        return { count: 0 };
      }
      return persistNormally(query);
    });

    if (failure === "database_error") {
      await expect(runLineBookingAlerts(now)).rejects.toThrow("Mock database unavailable");
    } else {
      await runLineBookingAlerts(now);
    }
    expect(mocks.push).toHaveBeenCalledTimes(2);
    const acceptedButUnsavedRequest = clone(mocks.push.mock.calls[1][0]);
    // The second recipient's pre-send persistence also saved the first
    // recipient's acceptance. Only the second send needs LINE retry-key replay.
    expect(alertFor().recipients.map((recipient) => recipient.status)).toEqual(["accepted", "pending"]);
    expect(alertFor().status).toBe("processing");
    const leaseExpiresAt = alertFor().nextAttemptAt;
    await runLineBookingAlerts(new Date(leaseExpiresAt - 1));
    expect(mocks.push).toHaveBeenCalledTimes(2);
    await runLineBookingAlerts(new Date(leaseExpiresAt));
    expect(mocks.push).toHaveBeenCalledTimes(3);
    expect(mocks.push.mock.calls[2][0]).toEqual(acceptedButUnsavedRequest);
    expect(mocks.push.mock.calls.filter(([payload]) => payload.lineUserId === doctorLineId)).toHaveLength(1);
    expect(alertFor().status).toBe("done");
    await runLineBookingAlerts(new Date(leaseExpiresAt + 60_000));
    expect(mocks.push).toHaveBeenCalledTimes(3);
  });

  it("dispatches pending work even after the doctor marks the in-app notification read", async () => {
    seedJob().readAt = new Date(now.getTime() - 1000);
    expect(await runLineBookingAlerts(now)).toMatchObject({ accepted: 2, claimed: 1 });
    expect(mocks.findJobs.mock.calls[0][0].join("")).not.toContain("readAt");
    expect(jobs.get("doctor-notification")!.readAt).toEqual(new Date(now.getTime() - 1000));
  });

  it("terminates an ambiguous delivery at eight attempts and raises attention without resending accepted work", async () => {
    seedJob();
    const alert = alertFor();
    alert.recipients[0].attempts = 7;
    alert.recipients[0].firstAttemptAt = now.getTime() - 60 * 60_000;
    alert.recipients[1].status = "accepted";
    alert.recipients[1].lineUserId = adminLineId;
    mocks.push.mockResolvedValue("retry");
    expect(await runLineBookingAlerts(now)).toMatchObject({ accepted: 0, attentionRequired: 1 });
    expect(alertFor().recipients[0]).toMatchObject({ attempts: 8, status: "failed", error: "line_send_unavailable" });
    expect(alertFor().status).toBe("done");
    expect(mocks.upsertNotification).toHaveBeenCalledOnce();
    await runLineBookingAlerts(new Date(now.getTime() + 60 * 60_000));
    expect(mocks.push).toHaveBeenCalledOnce();
  });

  it("does not send twice to the same LINE recipient", async () => {
    seedJob(); users.get("admin-user")!.lineUserId = doctorLineId;
    await runLineBookingAlerts(now);
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(alertFor().recipients[1]).toMatchObject({ status: "skipped", error: "duplicate_recipient" });
  });

  it.each(["inactive", "wrong_role", "unapproved", "unlinked"])("excludes an ineligible assigned doctor (%s) and raises durable attention", async (change) => {
    seedJob();
    const doctor = users.get("doctor-user")!;
    if (change === "inactive") doctor.status = "suspended";
    if (change === "wrong_role") doctor.role = "customer";
    if (change === "unapproved") doctor.doctorProfile!.status = "pending_review";
    if (change === "unlinked") doctor.lineUserId = "unlinked";
    expect(await runLineBookingAlerts(now)).toMatchObject({ accepted: 1, attentionRequired: 1 });
    expect(mocks.push.mock.calls[0][0].lineUserId).toBe(adminLineId);
    expect(alertFor().recipients[0]).toMatchObject({ status: "failed", error: "recipient_ineligible" });
    expect(mocks.upsertNotification).toHaveBeenCalledOnce();
  });

  it("preserves a failed-recipient attention marker when no Admin is configured", async () => {
    vi.stubEnv("LINE_BOOKING_ALERT_ADMIN_USER_ID", ""); seedJob();
    expect(await runLineBookingAlerts(now)).toMatchObject({ accepted: 1, attentionRequired: 1 });
    expect(jobs.get("doctor-notification")!.metadataJson.lineBookingAlertAttention).toBe(true);
    expect(mocks.upsertNotification).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledOnce();
  });

  it("refuses an Admin configuration change after confirmation instead of sending to a different account", async () => {
    seedJob(); vi.stubEnv("LINE_BOOKING_ALERT_ADMIN_USER_ID", "replacement-admin");
    await runLineBookingAlerts(now);
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(alertFor().recipients[1]).toMatchObject({ status: "failed", error: "recipient_ineligible" });
  });

  it("does not retry to a changed LINE linkage after an ambiguous first send", async () => {
    seedJob(); mocks.push.mockResolvedValueOnce("retry");
    await runLineBookingAlerts(now);
    users.get("doctor-user")!.lineUserId = `U${"c".repeat(32)}`;
    await runLineBookingAlerts(new Date(alertFor().nextAttemptAt));
    expect(mocks.push).toHaveBeenCalledTimes(2);
    expect(alertFor().recipients[0]).toMatchObject({ status: "failed", error: "recipient_ineligible" });
  });

  it.each(["cancelled", "pending_payment", "reschedule_required", "payment_pending", "different_doctor", "changed_time", "changed_duration", "expired", "past"])("skips stale or unconfirmed work (%s)", async (change) => {
    seedJob();
    let dispatchAt = now;
    if (["cancelled", "pending_payment", "reschedule_required"].includes(change)) consultation.status = change;
    if (change === "payment_pending") consultation.payment.status = "pending_review";
    if (change === "different_doctor") consultation.doctorId = "different-doctor";
    if (change === "changed_time") consultation.scheduledAt = new Date(scheduledAt.getTime() + 60_000);
    if (change === "changed_duration") consultation.bookedDurationMinutes = 30;
    if (change === "expired") dispatchAt = new Date(alertFor().expiresAt);
    if (change === "past") dispatchAt = new Date(scheduledAt.getTime() + 1);
    expect(await runLineBookingAlerts(dispatchAt)).toMatchObject({ accepted: 0, attentionRequired: 1 });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(alertFor().status).toBe("done");
    expect(alertFor().recipients.every((recipient) => recipient.status === "skipped")).toBe(true);
  });

  it("does not overwrite another worker's state when its claim loses the compare-and-swap", async () => {
    seedJob(); mocks.updateJobs.mockResolvedValueOnce({ count: 0 });
    expect(await runLineBookingAlerts(now)).toMatchObject({ claimed: 0, accepted: 0 });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(alertFor().status).toBe("pending");
  });

  it("marks permanent send failures and creates only a generic Admin nudge", async () => {
    seedJob(); mocks.push.mockResolvedValue("failed");
    expect(await runLineBookingAlerts(now)).toMatchObject({ accepted: 0, attentionRequired: 1 });
    expect(alertFor().recipients.every((recipient) => recipient.status === "failed")).toBe(true);
    const attention = mocks.upsertNotification.mock.calls[0][0];
    expect(attention.create).toMatchObject({ userId: "admin-user", channel: "in_app", metadataJson: { href: "/admin/notifications", audienceRole: "admin" } });
    expect(JSON.stringify(attention.create)).not.toMatch(/consultation-test|patient|nationalId|diagnosis|mock-access-token/);
  });
});
