import { z } from "zod";

const optionalLine = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(255, "รายละเอียดที่อยู่ยาวเกินไป").optional()
);

export const shippingAddressIdSchema = z.string().trim().min(1, "กรุณาเลือกที่อยู่จัดส่ง").max(191);

export const shippingAddressFormSchema = z.object({
  addressId: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(191).optional()
  ),
  label: z.string().trim().min(1, "กรุณาระบุชื่อที่อยู่").max(60),
  recipientName: z.string().trim().min(2, "กรุณาระบุชื่อผู้รับ").max(191),
  phone: z.string().trim().regex(/^(?:\+66|0)\d{8,9}$/, "กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง"),
  addressLine1: z.string().trim().min(5, "กรุณาระบุบ้านเลขที่และถนน").max(255),
  addressLine2: optionalLine,
  subdistrict: z.string().trim().min(2, "กรุณาระบุแขวงหรือตำบล").max(120),
  district: z.string().trim().min(2, "กรุณาระบุเขตหรืออำเภอ").max(120),
  province: z.string().trim().min(2, "กรุณาระบุจังหวัด").max(120),
  postalCode: z.string().trim().regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"),
  isDefault: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean())
});

export const setDefaultShippingAddressSchema = z.object({
  addressId: shippingAddressIdSchema
});
