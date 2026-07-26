import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { staffInviteRequestSchema } from "@/features/staff-invite/schema";
import { submitStaffInviteRequest } from "@/features/staff-invite/service";

function formDataToObject(formData: FormData) {
  return {
    ...Object.fromEntries(
      Array.from(formData.entries()).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    ),
    specialties: formData
      .getAll("specialties")
      .filter((value): value is string => typeof value === "string")
  };
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { message: "กรุณาเข้าสู่ระบบผ่าน LINE ก่อนส่งคำขอ" },
      { status: 401 }
    );
  }

  if (session.role !== "customer") {
    return NextResponse.json(
      { message: "บัญชีนี้มีสิทธิ์บุคลากรอยู่แล้ว หากต้องการเปลี่ยนสิทธิ์ให้ผู้ดูแลระบบตรวจในหน้าอนุมัติ" },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const parsed = staffInviteRequestSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "ข้อมูลคำขอไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  try {
    await submitStaffInviteRequest({
      userId: session.userId,
      data: parsed.data
    });
  } catch {
    return NextResponse.json(
      { message: "ยังส่งคำขอไม่ได้ กรุณาตรวจสอบสถานะบัญชีหรือฐานข้อมูลแล้วลองใหม่" },
      { status: 500 }
    );
  }

  revalidatePath(`/staff-invite/${parsed.data.role}`);
  revalidatePath("/admin/users");

  return NextResponse.json({
    message: "ส่งคำขอแล้ว ผู้ดูแลระบบจะตรวจสอบก่อนเปิดสิทธิ์ให้ใช้งาน"
  });
}
