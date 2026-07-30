"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import { createZoomMeetingIfConfigured } from "@/lib/zoom/meetings";
import { transitionDoctorConsultationSchema } from "@/features/doctor/consultations/workflow-schema";
import {
  applyDoctorConsultationTransition,
  getDoctorConsultationNextStatus
} from "@/features/doctor/consultations/workflow-service";

export type DoctorConsultationWorkflowActionState = {
  status: "idle" | "success" | "error";
  message: string;
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
        actorId: session.userId,
        actorRole: session.role,
        zoomMeeting
      });
    });

    revalidateDoctorWorkflow(parsed.data.consultationId);

    return {
      status: "success",
      message:
        parsed.data.transition === "start"
          ? zoomMeeting
            ? "เริ่มการปรึกษาและสร้างห้อง Zoom แล้ว"
            : "เริ่มการปรึกษาแล้ว ขณะนี้ใช้แชทในระบบเพราะยังไม่ได้ตั้งค่า Zoom"
          : "จบการปรึกษาและบันทึกสรุปแล้ว"
    };
  } catch {
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
