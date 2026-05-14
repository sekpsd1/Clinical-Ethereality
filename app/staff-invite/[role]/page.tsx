import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { StaffInviteRequest } from "@/features/staff-invite/StaffInviteRequest";
import { staffInviteRoleSchema, type StaffInviteRole } from "@/features/staff-invite/schema";

const statusLabels: Record<string, string> = {
  active: "ใช้งานอยู่",
  archived: "เก็บถาวร",
  pending_review: "รอผู้ดูแลระบบตรวจสอบ",
  suspended: "ระงับใช้งาน"
};

export default async function StaffInvitePage({
  params
}: {
  params: Promise<{
    role: string;
  }>;
}) {
  const { role: roleParam } = await params;
  const parsedRole = staffInviteRoleSchema.safeParse(roleParam);

  if (!parsedRole.success) {
    redirect("/consult");
  }

  const role = parsedRole.data satisfies StaffInviteRole;
  const session = await getCurrentSession();

  if (!session) {
    redirect(`/auth/line?next=/staff-invite/${role}`);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId
    },
    select: {
      displayName: true,
      lineUserId: true,
      status: true
    }
  });

  return (
    <StaffInviteRequest
      role={role}
      displayName={user?.displayName ?? session.displayName ?? user?.lineUserId ?? "บัญชี LINE"}
      currentStatus={statusLabels[user?.status ?? "active"] ?? "ใช้งานอยู่"}
    />
  );
}
