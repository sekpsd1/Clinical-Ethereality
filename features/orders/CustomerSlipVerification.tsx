import { PrivateSlipUpload } from "@/features/payments/PrivateSlipUpload";

type CustomerSlipVerificationProps = {
  paymentId: string;
  orderCode: string;
};

export function CustomerSlipVerification({ paymentId, orderCode }: CustomerSlipVerificationProps) {
  return <PrivateSlipUpload paymentId={paymentId} referenceLabel={orderCode} />;
}
