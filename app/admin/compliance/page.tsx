import { AdminIntegrationReadiness } from "@/features/admin/AdminIntegrationReadiness";
import { AdminCompliance } from "@/features/admin/AdminCompliance";
import { getIntegrationReadiness } from "@/features/admin/integrations/readiness";
import { getSmsOtpSchemaReadiness } from "@/features/admin/integrations/sms-otp-schema-readiness";

export default async function AdminCompliancePage() {
  const smsOtpSchema = await getSmsOtpSchemaReadiness();
  const readiness = getIntegrationReadiness(smsOtpSchema);

  return (
    <>
      <AdminIntegrationReadiness data={readiness} />
      <AdminCompliance />
    </>
  );
}
