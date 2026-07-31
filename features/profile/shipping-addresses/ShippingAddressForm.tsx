"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { initialFormActionState } from "@/lib/actions/server-actions";
import { saveShippingAddressAction } from "@/features/profile/shipping-addresses/actions";
import type { ShippingAddressView } from "@/features/profile/shipping-addresses/types";

const fields: Array<{ name: keyof ShippingAddressView; label: string; placeholder: string; type?: string }> = [
  { name: "label", label: "ชื่อที่อยู่", placeholder: "เช่น บ้าน หรือ ที่ทำงาน" },
  { name: "recipientName", label: "ชื่อผู้รับ", placeholder: "ชื่อ-นามสกุล" },
  { name: "phone", label: "เบอร์โทรศัพท์", placeholder: "0812345678", type: "tel" },
  { name: "addressLine1", label: "บ้านเลขที่ ถนน ซอย", placeholder: "บ้านเลขที่ อาคาร ถนน ซอย" },
  { name: "addressLine2", label: "รายละเอียดเพิ่มเติม (ถ้ามี)", placeholder: "ชั้น ห้อง หรือจุดสังเกต" },
  { name: "subdistrict", label: "แขวง / ตำบล", placeholder: "แขวงหรือตำบล" },
  { name: "district", label: "เขต / อำเภอ", placeholder: "เขตหรืออำเภอ" },
  { name: "province", label: "จังหวัด", placeholder: "จังหวัด" },
  { name: "postalCode", label: "รหัสไปรษณีย์", placeholder: "10110" }
];

export function ShippingAddressForm({ address }: { address?: ShippingAddressView }) {
  const [state, action] = useActionState(saveShippingAddressAction, initialFormActionState);
  return (
    <form action={action} className="mt-5 space-y-3 rounded-[24px] border border-primary/15 bg-white/80 p-5 shadow-sm">
      <h2 className="text-base font-extrabold text-primary">{address ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่ใหม่"}</h2>
      {address ? <input type="hidden" name="addressId" value={address.id} /> : null}
      {fields.map((field) => (
        <label key={field.name} className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6e797a]">
          {field.label}
          <input
            required={field.name !== "addressLine2"}
            name={field.name}
            type={field.type ?? "text"}
            defaultValue={String(address?.[field.name] ?? "")}
            inputMode={field.name === "phone" || field.name === "postalCode" ? "numeric" : undefined}
            className="mt-2 h-11 w-full rounded-[12px] border border-[#bdc9ca]/60 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#191c1e] outline-none focus:border-primary"
            placeholder={field.placeholder}
          />
        </label>
      ))}
      <label className="flex items-center gap-3 rounded-[14px] bg-primary/5 px-4 py-3 text-sm font-bold text-primary">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault ?? false} className="size-4 accent-primary" />
        ใช้เป็นที่อยู่เริ่มต้น
      </label>
      {state.status !== "idle" ? <p role="status" className={`rounded-[12px] px-3 py-2 text-sm font-semibold ${state.status === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{state.message}</p> : null}
      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-white shadow-chip disabled:opacity-60">
      <Check aria-hidden="true" className="size-4" />
      {pending ? "กำลังบันทึก..." : "บันทึกที่อยู่"}
    </button>
  );
}
