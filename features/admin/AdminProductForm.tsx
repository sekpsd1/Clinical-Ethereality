"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save, Upload } from "lucide-react";
import { upsertProductAction } from "@/features/admin/products/actions";
import { productCategories } from "@/features/products/categories";
import { cn } from "@/lib/design-system/variants";
import type { AdminProductActionState } from "@/features/admin/products/actions";
import type { AdminProductItem } from "@/features/admin/products/types";

type AdminProductFormProps = {
  product?: AdminProductItem;
};

const initialActionState: AdminProductActionState = {
  status: "idle",
  message: ""
};

export function AdminProductForm({ product }: AdminProductFormProps) {
  const [state, action] = useActionState(upsertProductAction, initialActionState);

  return (
    <form action={action} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <div className="grid gap-3">
        <TextField label="ชื่อสินค้า" name="name" defaultValue={product?.name ?? ""} placeholder="ชื่อสินค้า" />
        <TextField label="Slug" name="slug" defaultValue={product?.slug ?? ""} placeholder="clinical-product-name" />
        <label>
          <span className="block text-[10px] font-bold uppercase text-muted">หมวดหมู่สินค้า</span>
          <select
            className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
            defaultValue={product?.category ?? "other"}
            name="category"
          >
            {productCategories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <ProductImageUploadStub defaultImageUrl={product?.imageUrl ?? ""} />
        <TextAreaField
          label="รายละเอียดย่อ"
          name="shortDescription"
          defaultValue={product?.shortDescription ?? ""}
          placeholder="ข้อความสั้นสำหรับการ์ดสินค้า ไม่เกิน 300 ตัวอักษร"
          minHeightClass="min-h-16"
        />
        <TextAreaField
          label="รายละเอียดเต็ม"
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="ข้อมูลสินค้าฉบับเต็มสำหรับหน้ารายละเอียด"
        />
        <TextAreaField
          label="วิธีใช้"
          name="usageInstructions"
          defaultValue={product?.usageInstructions ?? ""}
          placeholder="วิธีใช้ ปริมาณ และความถี่ตามข้อมูลที่ได้รับอนุมัติ"
        />
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <TextField
            label="เลข อย."
            name="fdaNumber"
            defaultValue={product?.fdaNumber ?? ""}
            placeholder="เว้นว่างหากรอยืนยัน"
          />
          <TextField label="ราคา" name="price" defaultValue={product?.price ?? "0.00"} placeholder="0.00" type="number" />
        </div>
        <TextAreaField
          label="คำเตือน / ข้อห้ามใช้"
          name="warnings"
          defaultValue={product?.warnings ?? ""}
          placeholder="อาการแพ้ กลุ่มที่ไม่ควรใช้ และข้อควรระวัง"
        />
        <TextAreaField
          label="การเก็บรักษา"
          name="storageInstructions"
          defaultValue={product?.storageInstructions ?? ""}
          placeholder="อุณหภูมิ แสง ความชื้น และข้อกำหนดการเก็บรักษา"
          minHeightClass="min-h-16"
        />
        <TextAreaField
          label="หมายเหตุการจัดเตรียม / จัดส่ง"
          name="specialFulfillmentNotes"
          defaultValue={product?.specialFulfillmentNotes ?? ""}
          placeholder="เช่น ต้องควบคุมอุณหภูมิ หรือมีขั้นตอนแพ็กเฉพาะ"
          minHeightClass="min-h-16"
        />
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <label>
            <span className="block text-[10px] font-bold uppercase text-muted">สถานะ</span>
            <select
              className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
              defaultValue={product?.status ?? "draft"}
              name="status"
            >
              <option value="draft">ฉบับร่าง</option>
              <option value="active">เผยแพร่</option>
              <option value="archived">เก็บถาวร</option>
            </select>
          </label>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex min-w-0 items-center gap-2 text-xs font-bold text-muted">
              <input
                className="size-4 rounded border-border text-primary"
                defaultChecked={product?.requiresPrescription ?? false}
                name="requiresPrescription"
                type="checkbox"
              />
              ต้องใช้ใบสั่งยา
            </label>
            <label className="flex min-w-0 items-center gap-2 text-xs font-bold text-muted">
              <input
                className="size-4 rounded border-border text-primary"
                defaultChecked={product?.controlledOrRestricted ?? false}
                name="controlledOrRestricted"
                type="checkbox"
              />
              สินค้าควบคุม/จำกัด
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/70 pt-3">
          <SubmitButton label={product ? "บันทึกสินค้า" : "สร้างสินค้า"} />
        </div>
      </div>
      {state.status !== "idle" ? (
        <p
          className={cn(
            "mt-3 text-right text-[11px] font-semibold leading-4",
            state.status === "success" ? "text-success" : "text-danger"
          )}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function TextAreaField({
  defaultValue,
  label,
  minHeightClass = "min-h-24",
  name,
  placeholder
}: {
  defaultValue: string;
  label: string;
  minHeightClass?: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label>
      <span className="block text-[10px] font-bold uppercase text-muted">{label}</span>
      <textarea
        className={cn(
          "mt-1 w-full resize-y rounded-[8px] border border-border bg-white px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary",
          minHeightClass
        )}
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function ProductImageUploadStub({ defaultImageUrl }: { defaultImageUrl: string }) {
  const [selectedFileName, setSelectedFileName] = useState("");

  return (
    <div className="grid gap-2">
      <TextField
        label="ลิงก์รูปภาพที่อัปโหลดไว้แล้ว"
        name="imageUrl"
        defaultValue={defaultImageUrl}
        placeholder="/images/products/example.png หรือ https://cdn.example.com/product.png"
        hint="ใช้เฉพาะรูปสินค้าที่อัปโหลดไว้แล้ว ห้ามใส่ลิงก์เอกสารส่วนตัว ใบอนุญาต สลิป หรือข้อมูล sensitive"
      />
      <div className="rounded-[8px] border border-dashed border-primary/30 bg-primary/5 px-3 py-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] bg-white px-3 py-2 text-xs font-bold text-primary shadow-chip">
          <Upload aria-hidden="true" className="size-4" strokeWidth={2.1} />
          เลือกไฟล์รูปสินค้า
          <input
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            type="file"
            onChange={(event) => {
              setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "");
            }}
          />
        </label>
        <p className="mt-2 text-[11px] font-semibold leading-5 text-muted">
          {selectedFileName
            ? `เลือกไฟล์แล้ว: ${selectedFileName} ยังไม่อัปโหลดจริง กรุณาใส่ลิงก์หลังอัปโหลดในช่องด้านบน`
            : "ยังไม่ใช่ช่องอัปโหลดไฟล์จริง ใช้เพื่อเตรียม UX ก่อนเชื่อม Cloudinary/S3"}
        </p>
      </div>
    </div>
  );
}

function TextField({
  defaultValue,
  hint,
  label,
  name,
  placeholder,
  type = "text"
}: {
  defaultValue: string;
  hint?: string;
  label: string;
  name: string;
  placeholder: string;
  type?: "number" | "text";
}) {
  return (
    <label>
      <span className="block text-[10px] font-bold uppercase text-muted">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
        aria-describedby={hint ? `${name}-hint` : undefined}
        defaultValue={defaultValue}
        min={type === "number" ? 0 : undefined}
        name={name}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        type={type}
      />
      {hint ? (
        <span id={`${name}-hint`} className="mt-1 block text-[11px] font-semibold leading-5 text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
      aria-label={label}
      disabled={pending}
    >
      <Save aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
