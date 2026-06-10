import { AdminIntegrationReadiness } from "@/features/admin/AdminIntegrationReadiness";
import { AdminCompliance } from "@/features/admin/AdminCompliance";
import { getIntegrationReadiness } from "@/features/admin/integrations/readiness";

export default function AdminCompliancePage() {
  const readiness = getIntegrationReadiness();

  return (
    <>
      <AdminIntegrationReadiness data={readiness} />
      <AdminCompliance />
    </>
  );
}
