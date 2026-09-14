"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import { createZoomMeetingIfConfigured } from "@/lib/zoom/meetings";
import { transitionDoctorConsultationSchema } from "@/features/doctor/consultations/workflow-schema";
import {
  applyDoctorConsultationTransition,
  assertDoctorConsultationStartIdentityGate,
  DoctorConsultationWorkflowError,
  getDoctorConsultationNextStatus,
  PATIENT_IDENTITY_REVEAL_TTL_MS,
  type DoctorConsultationStartSnapshot
} from "@/features/doctor/consultations/workflow-service";

export type DoctorConsultationWorkflowActionState = {
  status: "idle" | "success" | "error";
  message: string;
  roomHref?: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function transitionDoctorConsultationAction(
  _previousState: DoctorConsultationWorkflowActionState,
  formData: FormData
): Promise<DoctorConsultationWorkflowActionState> {
  const session = await requireDoctorSession();
  const parsed = transitionDoctorConsultationSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message:
        formData.get("transition") === "start"
          ? "กรุณาเปิดข้อมูลและยืนยันตัวตนกับผู้ป่วยก่อนเริ่มการปรึกษา"
          : "กรุณาตรวจข้อมูลและเขียนสรุปอย่างน้อย 5 ตัวอักษรก่อนจบการปรึกษา"
    };
  }

  try {
    const now = new Date();
    const [consultation, actor, identityRevealAudit] = await Promise.all([
      prisma.consultation.findUnique({
        where: {
          id: parsed.data.consultationId
        },
        select: {
          id: true,
          patientId: true,
          status: true,
          scheduledAt: true,
          bookedDurationMinutes: true,
          zoomMeetingId: true,
          doctor: {
            select: {
              userId: true,
              status: true,
              user: { select: { status: true } }
            }
          },
          patient: {
            select: {
              role: true,
              status: true,
              fullName: true,
              nationalId: true,
              dateOfBirth: true,
              phone: true,
              normalizedPhone: true,
              phoneVerifiedAt: true
            }
          }
        }
      }),
      parsed.data.transition === "start"
        ? prisma.user.findUnique({
            where: { id: session.userId },
            select: { id: true, role: true, status: true }
          })
        : Promise.resolve(null),
      parsed.data.transition === "start"
        ? prisma.auditLog.findFirst({
            where: {
              actorId: session.userId,
              action: "consultation.patient_identity_view",
              entityType: "consultation",
              entityId: parsed.data.consultationId,
              createdAt: {
                gte: new Date(now.getTime() - PATIENT_IDENTITY_REVEAL_TTL_MS)
              }
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
          })
        : Promise.resolve(null)
    ]);

    getDoctorConsultationNextStatus(consultation, session, parsed.data.transition, now);

    if (parsed.data.transition === "start") {
      assertDoctorConsultationStartIdentityGate(
        consultation as DoctorConsultationStartSnapshot,
        actor,
        session,
        parsed.data.identityConfirmed,
        identityRevealAudit,
        now
      );
    }

    const zoomMeeting =
      parsed.data.transition === "start" && !consultation?.zoomMeetingId
        ? await createZoomMeetingIfConfigured({
            consultationId: parsed.data.consultationId,
            scheduledAt: consultation?.scheduledAt ?? null,
            bookedDurationMinutes: consultation?.bookedDurationMinutes ?? null
          })
        : null;

    await prisma.$transaction(async (tx) => {
      await applyDoctorConsultationTransition(tx, {
        consultationId: parsed.data.consultationId,
        transition: parsed.data.transition,
        summary: parsed.data.summary,
        noShowReason: parsed.data.noShowReason,
        actorId: session.userId,
        actorRole: session.role,
        zoomMeeting,
        identityConfirmed: parsed.data.identityConfirmed
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidateDoctorWorkflow(parsed.data.consultationId);

    return {
      status: "success",
      message:
        parsed.data.transition === "start"
          ? zoomMeeting
            ? "เริ่มการปรึกษาและสร้างห้อง Zoom แล้ว"
            : consultation?.zoomMeetingId
              ? "เริ่มการปรึกษาและเปิดห้อง Zoom เดิมแล้ว"
              : "เริ่มการปรึกษาแล้ว ขณะนี้ใช้แชทในระบบเพราะยังไม่ได้ตั้งค่า Zoom"
          : parsed.data.transition === "complete_no_show"
            ? "บันทึกผลผู้ป่วยไม่มาตามนัดและแจ้งผู้ป่วยแล้ว"
            : "จบการปรึกษาและบันทึกสรุปแล้ว",
      roomHref:
        parsed.data.transition === "start"
          ? `/consult/live?consultation=${parsed.data.consultationId}`
          : undefined
    };
  } catch (error) {
    if (
      error instanceof DoctorConsultationWorkflowError &&
      (error.code === "before_appointment_time" ||
        error.code === "missing_appointment_time")
    ) {
      return {
        status: "error",
        message:
          error.code === "before_appointment_time"
            ? "เปิดห้องได้ก่อนเวลานัด 5 นาที กรุณารอจนถึงช่วงเวลาเตรียมห้อง"
            : "นัดหมายนี้ไม่มีเวลาเริ่มที่ยืนยันแล้ว กรุณาให้ทีมงานตรวจสอบก่อน"
      };
    }

    if (error instanceof DoctorConsultationWorkflowError) {
      if (
        error.code === "identity_confirmation_required" ||
        error.code === "patient_identity_incomplete"
      ) {
        return {
          status: "error",
          message:
            error.code === "identity_confirmation_required"
              ? "กรุณาเปิดข้อมูลและยืนยันตัวตนกับผู้ป่วยก่อนเริ่มการปรึกษา"
              : "ข้อมูลยืนยันตัวตนยังไม่ครบ กรุณาให้ลูกค้ายืนยันตัวตนก่อน"
        };
      }

      if (error.code === "attendance_not_verified") {
        return {
          status: "error",
          message: "ยังจบการปรึกษาไม่ได้ ต้องมีหลักฐานว่าแพทย์และผู้ป่วยอยู่ในห้อง Zoom เดียวกัน และแพทย์อยู่ต่อเนื่องครบเวลานัด"
        };
      }

      if (error.code === "no_show_not_eligible") {
        return {
          status: "error",
          message: "ยังบันทึกไม่มาตามนัดไม่ได้ แพทย์ต้องอยู่ใน Zoom ต่อเนื่องครบเวลานัดก่อน"
        };
      }

      if (error.code === "no_show_doctor_required" || error.code === "invalid_no_show_reason") {
        return {
          status: "error",
          message: "ยังบันทึกไม่มาตามนัดไม่ได้ กรุณาใช้บัญชีแพทย์ที่รับผิดชอบและเหตุผลที่ระบบกำหนด"
        };
      }
    }

    return {
      status: "error",
      message:
        parsed.data.transition === "start"
          ? "ยังเริ่มการปรึกษาไม่ได้ กรุณาตรวจสถานะนัดและการตั้งค่า Zoom"
          : "ยังจบการปรึกษาไม่ได้ กรุณาตรวจสถานะและลองใหม่"
    };
  }
}

function revalidateDoctorWorkflow(consultationId: string) {
  revalidatePath("/doctor/consultations");
  revalidatePath("/doctor/patients");
  revalidatePath("/consult/live");
  revalidatePath(`/consult/appointments/${consultationId}`);
  revalidatePath("/notifications");
  revalidatePath("/admin");
}
