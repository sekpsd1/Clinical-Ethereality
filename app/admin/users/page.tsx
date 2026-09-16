import { randomUUID } from "node:crypto";
import { AdminUserApprovals } from "@/features/admin/AdminUserApprovals";
import {
  normalizeAdminStaffPage,
  normalizeAdminStaffQuery,
  normalizeAdminStaffTab
} from "@/features/admin/users/filters";
import { getAdminUserApprovals } from "@/features/admin/users/queries";
import { getAdminDoctorInvitations } from "@/features/admin/users/doctor-invite-queries";
import { requireActiveAdminSession } from "@/lib/auth/guards";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    doctorQ?: string;
    status?: string;
  }>;
}) {
  const session = await requireActiveAdminSession();
  const params = await searchParams;
  const [data, doctorInvitations] = await Promise.all([
    getAdminUserApprovals({
      page: normalizeAdminStaffPage(params.page),
      query: normalizeAdminStaffQuery(params.q),
      doctorQuery: normalizeAdminStaffQuery(params.doctorQ),
      status: normalizeAdminStaffTab(params.status)
    }),
    getAdminDoctorInvitations(session.userId)
  ]);

  return (
    <AdminUserApprovals
      data={data}
      currentUserId={session.userId}
      doctorInvitations={doctorInvitations}
      doctorInviteIdempotencyKey={randomUUID()}
    />
  );
}
