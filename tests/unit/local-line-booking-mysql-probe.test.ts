import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { bookingLineAlertMetadata, bookingAlertSchema } from "@/features/notifications/line-booking-alert";
import { runLineBookingAlerts } from "@/features/notifications/line-booking-job";

const transport = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notifications/line-push", () => ({ pushLineBookingAlert: transport }));
const now = new Date("2030-01-02T09:00:00.000Z");
const scheduledAt = new Date("2030-01-02T12:00:00.000Z");
const doctorLineId = `U${randomUUID().replaceAll("-", "")}`;
const adminLineId = `U${randomUUID().replaceAll("-", "")}`;
const runId = randomUUID();
const doctorId = `doctor-${runId}`;
const adminId = `admin-${runId}`;
const patientId = `patient-${runId}`;
const doctorProfileId = `profile-${runId}`;
const jobIds: string[] = [];
let disposableDatabaseVerified = false;

describe.skipIf(process.env.RUN_LINE_BOOKING_MYSQL_TESTS !== "true")("LINE booking queue on disposable MySQL", () => {
  beforeAll(async () => {
    if (!/^mysql:\/\/probe:local_probe_only@127\.0\.0\.1:\d+\/line_alert_probe$/.test(process.env.DATABASE_URL ?? "")) {
      throw new Error("Disposable loopback database required.");
    }
    disposableDatabaseVerified = true;
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network transport prohibited in this probe."); }));
    vi.stubEnv("ENABLE_LINE_BOOKING_ALERTS", "true");
    vi.stubEnv("LINE_BOOKING_ALERT_ADMIN_USER_ID", adminId);
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "fake-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://clinic.example.test");
    await prisma.user.createMany({ data: [
      { id: adminId, lineUserId: adminLineId, role: "admin" },
      { id: doctorId, lineUserId: doctorLineId, role: "doctor" },
      { id: patientId, lineUserId: `synthetic-${runId}` }
    ] });
    await prisma.doctor.create({ data: { id: doctorProfileId, userId: doctorId, status: "approved" } });
  });

  afterAll(async () => {
    try {
      if (disposableDatabaseVerified) {
        await prisma.notification.deleteMany({ where: { userId: { in: [doctorId, adminId] } } });
        await prisma.payment.deleteMany({ where: { consultationId: { in: jobIds } } });
        await prisma.consultation.deleteMany({ where: { id: { in: jobIds } } });
        await prisma.doctor.deleteMany({ where: { id: doctorProfileId } });
        await prisma.user.deleteMany({ where: { id: { in: [patientId, doctorId, adminId] } } });
      }
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      await prisma.$disconnect();
    }
  });

  async function addJob(scenario: string) {
    const id = `${scenario}-${runId}`;
    jobIds.push(id);
    const consultation = await prisma.consultation.create({ data: {
      id, patientId, doctorId: doctorProfileId, scheduledAt, bookedDurationMinutes: 15,
      status: "scheduled", payment: { create: { amount: 1, status: "verified" } }
    } });
    await prisma.notification.create({ data: {
      id, userId: doctorId, type: "consultation", title: "Synthetic",
      metadataJson: { consultationId: id, ...bookingLineAlertMetadata({
        doctorId: consultation.doctorId, doctorUserId: doctorId, scheduledAt, bookedDurationMinutes: 15
      }, now) }
    } });
    return id;
  }

  async function readJob(id: string) {
    const row = await prisma.notification.findUniqueOrThrow({ where: { id } });
    return bookingAlertSchema.parse((row.metadataJson as Record<string, unknown>).lineBookingAlert);
  }

  it("claims a due notification once across concurrent workers even after it was read", async () => {
    const id = await addJob("probe-concurrent");
    await prisma.notification.update({ where: { id }, data: { readAt: now } });
    transport.mockReset().mockResolvedValue("accepted");
    const results = await Promise.all([runLineBookingAlerts(now), runLineBookingAlerts(now)]);
    expect(results.reduce((count, row) => count + row.claimed, 0)).toBe(1);
    expect(transport.mock.calls.map(([input]) => input.lineUserId)).toEqual([doctorLineId, adminLineId]);
    expect((await readJob(id)).status).toBe("done");
    expect((await runLineBookingAlerts(now)).claimed).toBe(0);
  });

  it("resumes an interrupted delivery using the same recipient, text and retry key", async () => {
    const id = await addJob("probe-interrupted");
    transport.mockReset().mockResolvedValueOnce("accepted").mockRejectedValueOnce(new Error("synthetic process interruption"));
    await expect(runLineBookingAlerts(now)).rejects.toThrow("synthetic process interruption");
    const saved = await readJob(id);
    const originalRequest = transport.mock.calls[1][0];
    expect(saved.status).toBe("processing");
    expect(saved.recipients.map(r => r.status)).toEqual(["accepted", "pending"]);
    expect((await runLineBookingAlerts(new Date(saved.nextAttemptAt - 1))).claimed).toBe(0);
    transport.mockResolvedValue("accepted");
    const result = await runLineBookingAlerts(new Date(saved.nextAttemptAt + 1));
    expect(result).toMatchObject({ claimed: 1, accepted: 1, attentionRequired: 0 });
    expect(transport).toHaveBeenCalledTimes(3);
    expect(transport.mock.calls[2][0]).toEqual(originalRequest);
    expect((await readJob(id)).recipients.map(r => r.status)).toEqual(["accepted", "accepted"]);
  });

  it("reports a durable attention flag and one Admin nudge on a permanent failure", async () => {
    const id = await addJob("probe-failure");
    transport.mockReset().mockResolvedValue("failed");
    expect(await runLineBookingAlerts(now)).toMatchObject({ claimed: 1, accepted: 0, attentionRequired: 1 });
    expect((await readJob(id)).status).toBe("done");
    expect(await prisma.notification.count({ where: { id: `line-alert-attention:${id}`, userId: adminId } })).toBe(1);
    expect(await runLineBookingAlerts(now)).toMatchObject({ claimed: 0, attentionRequired: 1 });
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
