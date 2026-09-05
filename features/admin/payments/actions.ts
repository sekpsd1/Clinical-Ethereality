"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { assertPermission } from "@/lib/permissions";
import {
  manualAppointmentPaymentDecisionSchema,
  manualAppointmentPaymentIntakeSchema,
  manualConsultationPaymentReviewSchema,
  manualStoreRefundSchema,
  reviewPaymentSchema
} from "@/features/admin/payments/schema";
import { applyManualPaymentReview } from "@/features/payments/service";
import { applyManualStoreRefund } from "@/features/payments/refunds";
import { getManualStoreRefundReadiness } from "@/features/payments/refund-readiness";
import {
  applyManualAppointmentPaymentDecision,
  applyManualConsultationPaymentReview,
  ConsultationManualReviewError,
  createManualAppointmentPaymentIntake,
  getManualAppointmentIntake,
  ManualAppointmentIntakeError
} from "@/features/consultations/payment/manual-review";
import {
  getPaymentSlipErrorMessage,
  preparePrivatePaymentSlip
} from "@/features/payments/private-slips";
import { releaseExpiredConsultationSlotLocks } from "@/features/consultations/booking/lock-release";

export type AdminPaymentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  consultationId?: string;
  paymentId?: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function isPaymentEvidenceFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

async function findMatchingManualAppointmentIntake(input: {
  doctorId: string;
  patientId: string;
  reasonCode: string;
  scheduledAt: Date;
  transferredAt: Date;
}) {
  const consultation = await prisma.consultation.findFirst({
    where: {
      doctorId: input.doctorId,
      patientId: input.patientId,
      scheduledAt: input.scheduledAt,
      status: {
        in: ["pending_payment", "reschedule_required", "scheduled"]
      }
    },
    select: {
      id: true,
      payment: {
        select: { id: true, status: true, verificationPayload: true }
      }
    }
  });
  const intake = consultation?.payment
    ? getManualAppointmentIntake(consultation.payment.verificationPayload)
    : null;
  return consultation?.payment &&
    intake?.reasonCode === input.reasonCode &&
    intake.transferredAt.getTime() === input.transferredAt.getTime()
    ? {
        consultationId: consultation.id,
        paymentId: consultation.payment.id,
        status:
          consultation.payment.status === "verified"
            ? ("already_processed" as const)
            : ("already_pending" as const)
      }
    : null;
}

export async function createManualAppointmentPaymentIntakeAction(
  _previousState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  const session = await requireAdminSession();
  assertPermission(session, "consultation:manual-create");
  const parsed = manualAppointmentPaymentIntakeSchema.safeParse(
    formDataToObject(formData)
  );
  const evidence = formData.get("evidence");
  if (!parsed.success || !isPaymentEvidenceFile(evidence)) {
    return {
      status: "error",
      message: "ข้อมูลนัดหมายหรือหลักฐานการโอนไม่ถูกต้อง"
    };
  }

  try {
    await releaseExpiredConsultationSlotLocks();
  } catch {
    return {
      status: "error",
      message: "ยังตรวจสอบสถานะช่วงเวลาไม่ได้ กรุณาลองใหม่"
    };
  }

  const patient = await prisma.user
    .findUnique({
      where: { id: parsed.data.patientId },
      select: {
        role: true,
        status: true,
        fullName: true,
        dateOfBirth: true,
        phone: true,
        normalizedPhone: true,
        phoneVerifiedAt: true
      }
    })
    .catch(() => null);
  if (
    !patient ||
    patient.role !== "customer" ||
    patient.status !== "active" ||
    !patient.fullName ||
    !patient.dateOfBirth ||
    !patient.phone ||
    !patient.normalizedPhone ||
    !patient.phoneVerifiedAt
  ) {
    return {
      status: "error",
      message: "เลือกได้เฉพาะบัญชีผู้ป่วยที่ยืนยันข้อมูลและเบอร์โทรแล้ว"
    };
  }

  let prepared: Awaited<ReturnType<typeof preparePrivatePaymentSlip>>;
  try {
    prepared = await preparePrivatePaymentSlip({
      file: evidence,
      ownerId: parsed.data.patientId,
      paymentId: `manual-appointment:${parsed.data.doctorId}:${parsed.data.scheduledAt}`
    });
  } catch (error) {
    return { status: "error", message: getPaymentSlipErrorMessage(error) };
  }

  try {
    const outcome = await prisma.$transaction(
      (tx) =>
        createManualAppointmentPaymentIntake(tx, {
          actorId: session.userId,
          availabilityId: parsed.data.availabilityId,
          doctorId: parsed.data.doctorId,
          evidence: prepared,
          patientId: parsed.data.patientId,
          reasonCode: parsed.data.reasonCode,
          scheduledAt: new Date(parsed.data.scheduledAt),
          transferredAt: parsed.data.transferredAt
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (outcome.status !== "created") await prepared.cleanup();

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/schedules");
    revalidatePath("/notifications");

    return {
      status: "success",
      message:
        outcome.status === "created"
          ? "รับหลักฐานแล้ว รายการยังรอตรวจและยังไม่ยืนยันนัดหมาย"
          : "รายการนี้ถูกส่งเข้าคิวตรวจแล้ว",
      consultationId: outcome.consultationId,
      paymentId: outcome.paymentId
    };
  } catch (error) {
    await prepared.cleanup();
    if (
      error instanceof ManualAppointmentIntakeError &&
      error.code === "SLOT_UNAVAILABLE"
    ) {
      const existing = await findMatchingManualAppointmentIntake({
        doctorId: parsed.data.doctorId,
        patientId: parsed.data.patientId,
        reasonCode: parsed.data.reasonCode,
        scheduledAt: new Date(parsed.data.scheduledAt),
        transferredAt: parsed.data.transferredAt
      }).catch(() => null);
      if (existing) {
        return {
          status: "success",
          message: "รายการนี้ถูกส่งเข้าคิวตรวจแล้ว",
          consultationId: existing.consultationId,
          paymentId: existing.paymentId
        };
      }
    }
    const messages: Partial<Record<ManualAppointmentIntakeError["code"], string>> = {
      PATIENT_NOT_VERIFIED: "บัญชีผู้ป่วยไม่ได้อยู่ในสถานะยืนยันที่อนุญาต",
      DOCTOR_NOT_ELIGIBLE: "แพทย์หรือค่าปรึกษาไม่พร้อมรับนัดหมาย",
      SLOT_UNAVAILABLE: "ช่วงเวลานี้ไม่ว่างหรือสถานะมีการเปลี่ยนแปลงแล้ว",
      TRANSFER_OUTSIDE_WINDOW: "เวลาโอนต้องไม่เกิน 24 ชั่วโมงก่อนส่งรายการ",
      CONFLICT: "ข้อมูลรายการมีการเปลี่ยนแปลง กรุณาตรวจสอบอีกครั้ง"
    };
    return {
      status: "error",
      message:
        error instanceof ManualAppointmentIntakeError
          ? messages[error.code] ?? "ไม่สามารถสร้างรายการรอตรวจได้"
          : "ไม่สามารถสร้างรายการรอตรวจได้"
    };
  }
}

export async function reviewPaymentAction(
  _previousState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  const session = await requireAdminSession();
  const parsed = reviewPaymentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอตรวจสอบสลิปไม่ถูกต้อง"
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await applyManualPaymentReview(tx, {
          paymentId: parsed.data.paymentId,
          status: parsed.data.status,
          actorId: session.userId,
          transactionReference: parsed.data.transactionReference
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกผลตรวจสอบสลิปได้ กรุณาลองใหม่"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");

  return {
    status: "success",
    message: parsed.data.status === "verified" ? "ยืนยันการชำระเงินแล้ว" : "ปฏิเสธสลิปและส่งกลับไปชำระใหม่แล้ว"
  };
}

export async function refundStorePaymentAction(
  _previousState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  const session = await requireAdminSession();
  const readiness = await getManualStoreRefundReadiness();

  if (readiness.status !== "ready") {
    return {
      status: "error",
      message: readiness.message
    };
  }

  const parsed = manualStoreRefundSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรอกข้อมูลการคืนเงินให้ครบ และยืนยันว่าโอนเงินภายนอกสำเร็จแล้ว"
    };
  }

  try {
    const outcome = await prisma.$transaction(
      (tx) =>
        applyManualStoreRefund(tx, {
          actorId: session.userId,
          paymentId: parsed.data.paymentId,
          refundAmount: parsed.data.refundAmount,
          refundReason: parsed.data.refundReason,
          refundTransactionReference: parsed.data.refundTransactionReference
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/orders");
    revalidatePath("/store/orders");

    return {
      status: "success",
      message: outcome === "already_refunded" ? "รายการนี้คืนเงินแล้ว" : "บันทึกการคืนเงินเต็มจำนวนแล้ว"
    };
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกการคืนเงินได้ โปรดตรวจสถานะคำสั่งซื้อและข้อมูลที่กรอก"
    };
  }
}

export async function reviewConsultationPaymentAction(
  _previousState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  const session = await requireAdminSession();
  assertPermission(session, "consultation-payment:manual-review");
  const parsed = manualConsultationPaymentReviewSchema.safeParse(
    formDataToObject(formData)
  );

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรอกข้อมูลตรวจรายการโอนให้ครบและใช้วันที่เวลาประเทศไทย"
    };
  }

  try {
    const outcome = await prisma.$transaction(
      (tx) =>
        applyManualConsultationPaymentReview(tx, {
          actorId: session.userId,
          amount: parsed.data.amount,
          customerReportedAt: parsed.data.customerReportedAt,
          paymentId: parsed.data.paymentId,
          reasonCode: parsed.data.reasonCode,
          transactionReference: parsed.data.transactionReference,
          transferredAt: parsed.data.transferredAt
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/doctor/consultations");
    revalidatePath("/doctor/notifications");
    revalidatePath("/notifications");

    return {
      status: "success",
      message:
        outcome === "already_processed"
          ? "รายการนี้ยืนยันไว้แล้ว"
          : outcome === "scheduled"
            ? "ยืนยันการชำระเงินและนัดหมายแล้ว"
            : "ยืนยันการชำระเงินแล้ว ลูกค้าต้องเลือกเวลาใหม่"
    };
  } catch (error) {
    const messages: Partial<
      Record<ConsultationManualReviewError["code"], string>
    > = {
      DUPLICATE_REFERENCE: "เลขอ้างอิงนี้ถูกใช้กับรายการที่ยืนยันแล้ว",
      INVALID_AMOUNT: "ยอดที่กรอกไม่ตรงกับยอดค่าปรึกษา",
      INVALID_CONTACT_WINDOW: "ลูกค้าต้องติดต่อ LINE OA ภายใน 24 ชั่วโมงหลังระบบตรวจสลิปล้มเหลว",
      INVALID_TRANSFER_TIME: "วันเวลาโอนไม่อยู่ในช่วงที่อนุญาต",
      MISSING_EVIDENCE: "ไม่พบสลิปส่วนตัวที่เชื่อมกับรายการนี้",
      NOT_ELIGIBLE: "รายการนี้ไม่เข้าเงื่อนไข Manual Consultation Payment Review",
      CONFLICT: "สถานะรายการเปลี่ยนแล้ว กรุณารีเฟรชก่อนตรวจใหม่"
    };
    return {
      status: "error",
      message:
        error instanceof ConsultationManualReviewError
          ? messages[error.code] ?? "ไม่สามารถยืนยันรายการนี้ได้"
          : "ไม่สามารถยืนยันรายการนี้ได้ กรุณาตรวจสถานะแล้วลองใหม่"
    };
  }
}

export async function reviewManualAppointmentPaymentAction(
  _previousState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  const session = await requireAdminSession();
  assertPermission(session, "consultation-payment:manual-review");
  const parsed = manualAppointmentPaymentDecisionSchema.safeParse(
    formDataToObject(formData)
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: "ข้อมูลผลตรวจรายการโอนไม่ถูกต้อง"
    };
  }

  try {
    const outcome = await prisma.$transaction(
      (tx) =>
        applyManualAppointmentPaymentDecision(
          tx,
          parsed.data.decision === "verified"
            ? {
                actorId: session.userId,
                decision: "verified",
                paymentId: parsed.data.paymentId,
                transactionReference: parsed.data.transactionReference
              }
            : {
                actorId: session.userId,
                decision: "rejected",
                paymentId: parsed.data.paymentId,
                rejectionReasonCode: parsed.data.rejectionReasonCode
              }
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/schedules");
    revalidatePath("/doctor/consultations");
    revalidatePath("/doctor/notifications");
    revalidatePath("/notifications");

    const messages: Record<typeof outcome, string> = {
      scheduled: "ยืนยันรายการโอนและนัดหมายแล้ว",
      reschedule_required:
        "ยืนยันรายการโอนแล้ว แต่ช่วงเวลาเดิมหมดอายุ ผู้ป่วยต้องเลือกเวลาใหม่",
      rejected: "ปฏิเสธรายการโอนและยกเลิกคำขอนัดหมายแล้ว",
      already_processed: "รายการนี้ได้รับการตรวจแล้ว"
    };
    return { status: "success", message: messages[outcome] };
  } catch (error) {
    const messages: Partial<Record<ConsultationManualReviewError["code"], string>> = {
      NOT_ELIGIBLE: "รายการนี้ไม่เข้าเงื่อนไข Manual Appointment Review",
      MISSING_EVIDENCE: "ไม่พบสลิปส่วนตัวที่เชื่อมกับรายการนี้",
      DUPLICATE_REFERENCE: "เลขอ้างอิงนี้ถูกใช้กับรายการที่ยืนยันแล้ว",
      CONFLICT: "สถานะรายการเปลี่ยนแล้ว กรุณารีเฟรชและตรวจสอบอีกครั้ง"
    };
    return {
      status: "error",
      message:
        error instanceof ConsultationManualReviewError
          ? messages[error.code] ?? "ไม่สามารถบันทึกผลตรวจรายการโอนได้"
          : "ไม่สามารถบันทึกผลตรวจรายการโอนได้"
    };
  }
}
