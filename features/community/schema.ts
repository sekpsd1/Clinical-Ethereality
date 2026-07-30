import { z } from "zod";
import { communityCategories } from "@/features/community/policy";

export const communityPostSchema = z.object({
  title: z.string().trim().min(5, "กรุณาระบุหัวข้ออย่างน้อย 5 ตัวอักษร").max(160),
  body: z.string().trim().min(20, "กรุณาระบุเนื้อหาอย่างน้อย 20 ตัวอักษร").max(5000),
  category: z.enum(communityCategories),
  privacyAccepted: z.literal("on", {
    errorMap: () => ({
      message: "กรุณายืนยันว่าโพสต์ไม่มีข้อมูลส่วนตัวหรือข้อมูลสุขภาพที่ระบุตัวบุคคลได้"
    })
  })
});

export const updateCommunityPostSchema = communityPostSchema.extend({
  articleId: z.string().min(1)
});
