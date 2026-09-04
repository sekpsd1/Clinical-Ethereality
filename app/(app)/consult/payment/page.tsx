import { ConsultPaymentCheckout } from "@/features/consultations/ConsultPaymentCheckout";
import { getConsultationPaymentData } from "@/features/consultations/payment/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function ConsultPaymentPage({
  searchParams
}: {
  searchParams: Promise<{
    consultation?: string;
    payment?: string;
    verify?: string;
  }>;
}) {
  const [session, params] = await Promise.all([requireCurrentSession(), searchParams]);
  const data = await getConsultationPaymentData(session, params.consultation, params.payment);

  return <ConsultPaymentCheckout data={data} autoVerifySlip={params.verify === "1"} />;
}
