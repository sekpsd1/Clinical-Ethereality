import type { PaymentStatus } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PaymentStatusBadgeProps = {
  status: PaymentStatus | "no_payment_record" | null;
  label?: string;
};

function getPaymentTone(status: PaymentStatusBadgeProps["status"]) {
  if (status === "verified") {
    return "success";
  }

  if (status === "rejected" || status === "refunded") {
    return "danger";
  }

  if (status === "pending_slip" || status === "pending_review") {
    return "warning";
  }

  return "neutral";
}

function getPaymentLabel(status: PaymentStatusBadgeProps["status"]) {
  if (status === "pending_slip") {
    return "รอสลิป";
  }

  if (status === "pending_review") {
    return "รอตรวจสอบ";
  }

  if (status === "verified") {
    return "ยืนยันแล้ว";
  }

  if (status === "rejected") {
    return "ไม่ผ่าน";
  }

  if (status === "refunded") {
    return "คืนเงิน";
  }

  return "ไม่มีข้อมูล";
}

export function PaymentStatusBadge({ status, label }: PaymentStatusBadgeProps) {
  return <StatusBadge tone={getPaymentTone(status)}>{label ?? getPaymentLabel(status)}</StatusBadge>;
}
