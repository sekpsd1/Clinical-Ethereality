import type { ConsultationStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { Role } from "@/lib/permissions/roles";
import type { CreatedZoomMeeting } from "@/lib/zoom/meetings";

export type DoctorConsultationTransition = "start" | "complete";

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

    if (scheduledAt.getTime() > now.getTime()) {
      throw new DoctorConsultationWorkflowError(
        "Consultation cannot start before the scheduled appointment time.",
        "before_appointment_time"
      );
    }
  }

  if (transition === "complete" && consultation.status !== "live") {
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
    actorId: string;
    actorRole: Role;
    zoomMeeting?: CreatedZoomMeeting | null;
  }
) {
  const consultation = await tx.consultation.findUnique({
    where: {
      id: input.consultationId
    },
    select: {
      id: true,
      patientId: true,
      status: true,
      scheduledAt: true,
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
        : {
            status: nextStatus,
            summary: input.summary?.trim()
          }
  });

  await tx.notification.create({
    data: {
      userId: consultation!.patientId,
      type: "consultation",
      channel: "in_app",
      title: input.transition === "start" ? "แพทย์เริ่มห้องปรึกษาแล้ว" : "การปรึกษาเสร็จสิ้นแล้ว",
      body:
        input.transition === "start"
          ? "คุณสามารถเปิดห้องปรึกษาและส่งข้อความถึงแพทย์ได้แล้ว"
          : "แพทย์บันทึกสรุปการปรึกษาเรียบร้อยแล้ว",
      metadataJson: {
        consultationId: input.consultationId,
        href:
          input.transition === "start"
            ? `/consult/live?consultation=${input.consultationId}`
            : `/consult/appointments/${input.consultationId}`
      }
    }
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: input.transition === "start" ? "consultation.start" : "consultation.complete",
    entityType: "consultation",
    entityId: input.consultationId,
    metadata: {
      previousStatus: consultation!.status,
      nextStatus,
      zoomMeetingCreated: Boolean(input.zoomMeeting),
      summaryLength: input.summary?.trim().length ?? 0
    }
  });

  return {
    nextStatus
  };
}
