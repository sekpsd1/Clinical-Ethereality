import { NextResponse } from "next/server";
import {
  approveStaffRoleAction,
  type AdminUserActionState
} from "@/features/admin/users/actions";
import { approveStaffRoleSchema } from "@/features/admin/users/schema";

const initialActionState: AdminUserActionState = {
  status: "idle",
  message: ""
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = approveStaffRoleSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "คำขออนุมัติไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const formData = new FormData();
    formData.set("userId", parsed.data.userId);
    formData.set("role", parsed.data.role);
    const result = await approveStaffRoleAction(initialActionState, formData);

    return NextResponse.json(
      { message: result.message },
      { status: result.status === "success" ? 200 : 400 }
    );
  } catch {
    return NextResponse.json(
      { message: "ไม่สามารถอนุมัติสิทธิ์ได้ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
