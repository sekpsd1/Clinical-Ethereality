import { Prisma, type ConsultationStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { Role } from "@/lib/permissions/roles";
import type { CreatedZoomMeeting } from "@/lib/zoom/meetings";
import { getConsultationAttendanceState } from "@/features/consultations/attendance/state";
import { getDoctorConsultationStartWindow } from "@/features/doctor/consultations/start-window";

export type DoctorConsultationTransition = "start" | "complete" | "complete_no_show";

export type DoctorConsultationWorkflowSnapshot = {
  id: string;
  patientId: string;
  status: ConsultationStatus;
  scheduledAt: Date | null;
  doctor: {
    userId: string;
  };
};

export class DoctorConsultationWorkflowError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "wrong_doctor"
      | "invalid_status"
      | "missing_appointment_time"
      | "before_appointment_time"
      | "attendance_not_verified"
      | "no_show_not_eligible"
      | "no_show_doctor_required"
      | "invalid_no_show_reason"
  ) {
    super(message);
    this.name = "DoctorConsultationWorkflowError";
  }
}

export function getDoctorConsultationNextStatus(
  consultation: DoctorConsultationWorkflowSnapshot | null,
  actor: {
    userId: string;
    role: Role;
  },
  transition: DoctorConsultationTransition,
  now = new Date()
): ConsultationStatus {
  if (!consultation) {
    throw new DoctorConsultationWorkflowError("Consultation not found.", "not_found");
  }

  if (actor.role === "doctor" && consultation.doctor.userId !== actor.userId) {
    throw new DoctorConsultationWorkflowError(
      "Doctor cannot update another doctor's consultation.",
      "wrong_doctor"
    );
  }

  if (transition === "start" && consultation.status !== "scheduled") {
    throw new DoctorConsultationWorkflowError(
      "Only scheduled consultations can be started.",
      "invalid_status"
    );
  }

  if (transition === "start") {
    const scheduledAt = consultation.scheduledAt;

    if (!scheduledAt) {
      throw new DoctorConsultationWorkflowError(
        "Consultation appointment time is required before starting.",
        "missing_appointment_time"
      );
    }

    if (!getDoctorConsultationStartWindow(scheduledAt, now).canStart) {
      throw new DoctorConsultationWorkflowError(
        "Consultation cannot start before the five-minute preparation window.",
        "before_appointment_time"
      );
    }
  }

  if (transition !== "start" && consultation.status !== "live") {
    throw new DoctorConsultationWorkflowError(
      "Only live consultations can be completed.",
      "invalid_status"
    );
  }

  return transition === "start" ? "live" : "completed";
}

export async function applyDoctorConsultationTransition(
  tx: Prisma.TransactionClient,
  input: {
    consultationId: string;
    transition: DoctorConsultationTransition;
    summary?: string;
    noShowReason?: "customer_did_not_join";
    actorId: string;
    actorRole: Role;
    zoomMeeting?: CreatedZoomMeeting | null;
    now?: Date;
  }
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${input.consultationId} FOR UPDATE`
  );
  const consultation = await tx.consultation.findUnique({
    where: {
      id: input.consultationId
    },
    select: {
      id: true,
      patientId: true,
      status: true,
      scheduledAt: true,
      attendanceEvents: {
        select: {
          role: true,
          eventType: true,
          meetingUuidHash: true,
          participantSessionHash: true,
          occurredAt: true
        }
      },
      doctor: {
        select: {
          userId: true
        }
      }
    }
  });
  const nextStatus = getDoctorConsultationNextStatus(
    consultation,
    {
      userId: input.actorId,
      role: input.actorRole
    },
    input.transition
  );
  const attendance = getConsultationAttendanceState(
    consultation?.attendanceEvents ?? [],
    consultation?.scheduledAt ?? null,
    input.now ?? new Date()
  );

  if (input.transition === "complete" && !attendance.normalCompletionEligible) {
    throw new DoctorConsultationWorkflowError(
      "Doctor and customer Zoom attendance is not verified in the same meeting.",
      "attendance_not_verified"
    );
  }

  if (input.transition === "complete_no_show") {
    if (input.actorRole !== "doctor") {
      throw new DoctorConsultationWorkflowError(
        "Only the assigned doctor can complete a no-show consultation.",
        "no_show_doctor_required"
      );
    }

    if (input.noShowReason !== "customer_did_not_join") {
      throw new DoctorConsultationWorkflowError(
        "A controlled no-show reason is required.",
        "invalid_no_show_reason"
      );
    }

    if (!attendance.noShowCompletionEligible) {
      throw new DoctorConsultationWorkflowError(
        "Verified continuous doctor attendance has not reached the no-show threshold.",
        "no_show_not_eligible"
      );
    }
  }

  if (input.transition === "complete" && (!input.summary || input.summary.trim().length < 5)) {
    throw new Error("Consultation summary is required.");
  }

  await tx.consultation.update({
    where: {
      id: input.consultationId
    },
    data:
      input.transition === "start"
        ? {
            status: nextStatus,
            zoomMeetingId: input.zoomMeeting?.meetingId,
            zoomPassword: input.zoomMeeting?.password,
            zoomJoinUrl: input.zoomMeeting?.joinUrl
          }
        : input.transition === "complete"
          ? {
            status: nextStatus,
            summary: input.summary?.trim(),
            completionOutcome: "normal",
            noShowReason: null
          }
          : {
              status: nextStatus,
              completionOutcome: "no_show",
              noShowReason: input.noShowReason
            }
  });

  await tx.notification.create({
    data: {
      userId: consultation!.patientId,
      type: "consultation",
      channel: "in_app",
      title:
        input.transition === "start"
          ? "แพทย์เริ่มห้องปรึกษาแล้ว"
          : input.transition === "complete_no_show"
            ? "บันทึกผลไม่มาตามนัดแล้ว"
            : "การปรึกษาเสร็จสิ้นแล้ว",
      body:
        input.transition === "start"
          ? "คุณสามารถเปิดห้องปรึกษาและส่งข้อความถึงแพทย์ได้แล้ว"
          : input.transition === "complete_no_show"
            ? "แพทย์รอในห้อง Zoom ตามเวลาที่กำหนด แต่ระบบไม่พบการเข้าร่วมของคุณ กรุณาติดต่อทีมงานเพื่อนัดหมายครั้งถัดไป"
            : "แพทย์บันทึกสรุปการปรึกษาเรียบร้อยแล้ว",
      metadataJson: {
        consultationId: input.consultationId,
        audienceRole: "customer",
        href:
          input.transition === "start"
            ? `/consult/live?consultation=${input.consultationId}`
            : `/consult/appointments/${input.consultationId}`
      }
    }
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action:
      input.transition === "start"
        ? "consultation.start"
        : input.transition === "complete_no_show"
          ? "consultation.no_show_complete"
          : "consultation.complete",
    entityType: "consultation",
    entityId: input.consultationId,
    metadata: {
      previousStatus: consultation!.status,
      nextStatus,
      zoomMeetingCreated: Boolean(input.zoomMeeting),
      completionOutcome:
        input.transition === "start"
          ? null
          : input.transition === "complete_no_show"
            ? "no_show"
            : "normal",
      noShowReason: input.transition === "complete_no_show" ? input.noShowReason : null,
      doctorAttendanceVerified: attendance.doctorEverJoined,
      customerAttendanceVerified: attendance.customerEverJoined,
      bothJoinedSameMeeting: attendance.bothJoinedSameMeeting,
      longestVerifiedDoctorPresenceSeconds: attendance.longestVerifiedDoctorPresenceSeconds,
      summaryLength: input.transition === "complete" ? input.summary?.trim().length ?? 0 : 0
    }
  });

  return {
    nextStatus
  };
}
