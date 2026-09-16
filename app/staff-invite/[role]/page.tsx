import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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

  if (role === "doctor") {
    return (
      <main className="min-h-dvh bg-app px-4 py-[calc(1.5rem+env(safe-area-inset-top))] text-text">
        <section className="mx-auto w-full max-w-mobile rounded-[24px] bg-primary-gradient p-5 text-white shadow-booking">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/15">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-label font-bold uppercase text-white/75">ข้อมูลแพทย์</p>
          <h1 className="mt-1 font-headline text-2xl font-bold">ผู้ดูแลระบบเป็นผู้จัดการข้อมูล</h1>
          <p className="mt-3 text-sm leading-6 text-white/85">
            บัญชี LINE ของคุณเชื่อมต่อกับระบบแล้ว ไม่ต้องกรอกหรือยืนยันข้อมูลวิชาชีพในหน้านี้ กรุณาแจ้งผู้ดูแลระบบให้ค้นหาบัญชี LINE และกรอกข้อมูลแพทย์ เอกสาร และอนุมัติสิทธิ์ให้ครบถ้วน
          </p>
          <p className="mt-3 rounded-[8px] bg-white/10 px-3 py-2 text-xs font-semibold leading-5 text-white/85">
            หลังผู้ดูแลอนุมัติแล้ว กรุณาออกจากระบบและเข้าใหม่เพื่อรับสิทธิ์แพทย์ในเซสชันใหม่
          </p>
        </section>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId
    },
    select: {
      displayName: true,
      lineUserId: true,
      status: true,
      doctorProfile: {
        select: {
          status: true
        }
      },
      pharmacistProfile: {
        select: {
          status: true
        }
      }
    }
  });
  const requestStatus =
    role === "pharmacist"
      ? user?.pharmacistProfile?.status
      : user?.status === "pending_review"
        ? "pending_review"
        : undefined;

  return (
    <StaffInviteRequest
      role={role}
      displayName={user?.displayName ?? session.displayName ?? user?.lineUserId ?? "บัญชี LINE"}
      currentStatus={statusLabels[requestStatus ?? user?.status ?? "active"] ?? "ใช้งานอยู่"}
      requestStatus={requestStatus}
    />
  );
}
