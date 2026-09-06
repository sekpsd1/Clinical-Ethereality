"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import { createZoomMeetingIfConfigured } from "@/lib/zoom/meetings";
import { transitionDoctorConsultationSchema } from "@/features/doctor/consultations/workflow-schema";
import {
  applyDoctorConsultationTransition,
  DoctorConsultationWorkflowError,
  getDoctorConsultationNextStatus
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
      message: "กรุณาตรวจข้อมูลและเขียนสรุปอย่างน้อย 5 ตัวอักษรก่อนจบการปรึกษา"
    };
  }

  try {
    const consultation = await prisma.consultation.findUnique({
      where: {
        id: parsed.data.consultationId
      },
      select: {
        id: true,
        patientId: true,
        status: true,
        scheduledAt: true,
        zoomMeetingId: true,
        doctor: {
          select: {
            userId: true
          }
        }
      }
    });

    getDoctorConsultationNextStatus(consultation, session, parsed.data.transition);

    const zoomMeeting =
      parsed.data.transition === "start" && !consultation?.zoomMeetingId
        ? await createZoomMeetingIfConfigured({
            consultationId: parsed.data.consultationId,
            scheduledAt: consultation?.scheduledAt ?? null
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
        zoomMeeting
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidateDoctorWorkflow(parsed.data.consultationId);

    return {
      status: "success",
      message:
        parsed.data.transition === "start"
          ? zoomMeeting
            ? "เริ่มการปรึกษาและสร้างห้อง Zoom แล้ว"
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
            ? "ยังไม่ถึงเวลานัด ระบบจึงยังไม่เปิดให้เริ่มการปรึกษา"
            : "นัดหมายนี้ไม่มีเวลาเริ่มที่ยืนยันแล้ว กรุณาให้ทีมงานตรวจสอบก่อน"
      };
    }

    if (error instanceof DoctorConsultationWorkflowError) {
      if (error.code === "attendance_not_verified") {
        return {
          status: "error",
          message: "ยังจบการปรึกษาไม่ได้ เพราะ Zoom ยังไม่ยืนยันว่าแพทย์และผู้ป่วยเข้าห้องเดียวกัน"
        };
      }

      if (error.code === "no_show_not_eligible") {
        return {
          status: "error",
          message: "ยังบันทึกไม่มาตามนัดไม่ได้ ต้องมีเวลารอของแพทย์ที่ Zoom ยืนยันต่อเนื่องครบ 10 นาทีก่อน"
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
