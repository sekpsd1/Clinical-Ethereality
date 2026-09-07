import { AdviceLog } from "@/features/consultations/AdviceLog";
import { getCustomerAdviceLog } from "@/features/consultations/advice-log/queries";
import { requireRoleSession } from "@/lib/auth/guards";

export default async function AdviceLogPage({
  searchParams
}: {
  searchParams: Promise<{
    consultation?: string;
  }>;
}) {
  const [session, params] = await Promise.all([
    requireRoleSession(["customer"], "/consult/advice-log"),
    searchParams
  ]);
  const data = await getCustomerAdviceLog(session, params.consultation);

  return <AdviceLog data={data} />;
}
