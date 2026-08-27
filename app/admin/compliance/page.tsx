import { AdminIntegrationReadiness } from "@/features/admin/AdminIntegrationReadiness";
import { AdminCompliance } from "@/features/admin/AdminCompliance";
import { getIntegrationReadiness } from "@/features/admin/integrations/readiness";
import { runApplicationMigrationStatusProbe } from "@/features/admin/integrations/migration-status-probe";
import { getSmsOtpSchemaReadiness } from "@/features/admin/integrations/sms-otp-schema-readiness";

export default async function AdminCompliancePage({
  searchParams
}: {
  searchParams: Promise<{ migrationStatusProbe?: string }>;
}) {
  const query = await searchParams;
  if (query.migrationStatusProbe === "1") {
    await runApplicationMigrationStatusProbe();
  }

  const smsOtpSchema = await getSmsOtpSchemaReadiness();
  const readiness = getIntegrationReadiness(smsOtpSchema);

  return (
    <>
      <AdminIntegrationReadiness data={readiness} />
      <AdminCompliance />
    </>
  );
}
