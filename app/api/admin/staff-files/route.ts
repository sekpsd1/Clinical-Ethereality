import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/guards";
import { assertPermission } from "@/lib/permissions";
import { uploadAdminStaffFile } from "@/features/admin/users/staff-files";
import {
  getStaffFileErrorMessage,
  StaffFileError
} from "@/features/staff-files/service";
import type { StaffFileKind } from "@/features/staff-files/types";

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    assertPermission(session, "admin:access");
    const formData = await request.formData();
    const userId = formData.get("userId");
    const kind = formData.get("kind");
    const file = formData.get("file");

    if (
      typeof userId !== "string" ||
      !userId ||
      (kind !== "profilePhoto" && kind !== "licenseProof") ||
      !(file instanceof File) ||
      file.size === 0
    ) {
      return NextResponse.json(
        { message: "ข้อมูลไฟล์ไม่ครบ กรุณาเลือกไฟล์แล้วลองใหม่" },
        { status: 400 }
      );
    }

    await uploadAdminStaffFile({
      actorId: session.userId,
      ownerId: userId,
      kind: kind as StaffFileKind,
      file
    });

    revalidatePath("/admin/users");

    return NextResponse.json({
      message: kind === "profilePhoto" ? "อัปโหลดรูปโปรไฟล์แล้ว" : "อัปโหลดเอกสารใบอนุญาตแล้ว"
    });
  } catch (error) {
    if (error instanceof StaffFileError) {
      return NextResponse.json(
        { message: getStaffFileErrorMessage(error) },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "STAFF_PROFILE_REQUIRED") {
      return NextResponse.json(
        { message: "อัปโหลดไฟล์บุคลากรได้เฉพาะบัญชีแพทย์หรือเภสัชกร" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "ไม่สามารถอัปโหลดไฟล์บุคลากรได้ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
